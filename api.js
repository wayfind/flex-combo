var urlLib = require("url");
var pathLib = require("path");
var fsLib = require("fs");
var mime = require("mime");
var async = require("async");
var mkdirp = require("mkdirp");
var merge = require("merge");
var fetch = require("fetch-agent");
var Stack = require("plug-trace").stack;
var Helper = require("./lib/util");

var ENGINES = [];

function FlexCombo(param, confFile) {
  this.HOST = null;
  this.URL = null;
  this.MIME = null;
  this.req = null;
  this.res = null;
  this.engines = ENGINES.map(function (i) {
    return i;
  });
  this.query = {};
  this.result = {};
  this.cacheDir = null;

  this.param = merge(true, require("./lib/param"));
  param = param || {};

  var pkgName = require(__dirname + "/package.json").name;
  this.trace = new Stack(pkgName);

  var confJSON = {};
  if (confFile) {
    this.cacheDir = pathLib.join(pathLib.dirname(confFile), "../.cache");

    if (!fsLib.existsSync(confFile)) {
      fsLib.writeFileSync(confFile, JSON.stringify(this.param, null, 2), {encoding: "utf-8"});
      fsLib.chmod(confFile, 0777);
    }

    try {
      confJSON = require(confFile);
      delete require.cache[confFile];

      param.hosts = merge.recursive(param.hosts, confJSON.hosts || {});
    }
    catch (e) {
      this.trace.error("Can't require config file!", "IO");
      confJSON = {};
    }
  }

  this.param = merge.recursive(true, this.param, confJSON, param);

  var rootdir = this.param.rootdir || "src";
  if (rootdir.indexOf('/') == 0 || /^\w{1}:[\\/].*$/.test(rootdir)) {
    this.param.rootdir = rootdir;
  }
  else {
    this.param.rootdir = pathLib.normalize(pathLib.join(process.cwd(), rootdir));
  }

  if (!this.param.urls['/']) {
    this.param.urls['/'] = this.param.rootdir;
  }
  if (!this.cacheDir) {
    this.cacheDir = pathLib.normalize(pathLib.join(this.param.rootdir, "../.cache"));
  }
  this.cacheDir = pathLib.join(this.cacheDir, pkgName);
  if (this.param.cache && !fsLib.existsSync(this.cacheDir)) {
    mkdirp(this.cacheDir, function (e, dir) {
      fsLib.chmod(dir, 0777);
      fsLib.chmod(this.cacheDir, 0777);
    }.bind(this));
  }
}
FlexCombo.prototype = {
  constructor: FlexCombo,
  parser: function (_url) {
    var url = urlLib.parse(_url).path.replace(/[\\|\/]{1,}/g, '/');
    var prefix = url.indexOf(this.param.servlet + '?');

    if (prefix != -1) {
      var base = url.slice(0, prefix);
      var file = url.slice(prefix + this.param.servlet.length + 1);
      var filelist = file.split(this.param.seperator, 1000);
      return filelist.map(function (i) {
        return urlLib.resolve(base, i);
      });
    }
    else {
      return [url];
    }
  },
  defineParser: function (func) {
    if (typeof func == "function") {
      this.parser = func;
      return true;
    }
    return false;
  },
  addEngine: function (rule, func, p, realtime) {
    var index = ["object", "function"].indexOf(typeof func);
    if (rule && index != -1) {
      (realtime ? this.engines : ENGINES).push({
        rule: rule,
        func: index ? func : function (absPath, reqOpt, param, cb) {
          cb(false, JSON.stringify(func), absPath);
        },
        path: p
      });
    }
  },
  buildRequestOption: function (url) {
    url = encodeURI(url);

    if (!this.req) {
      return {path: url};
    }
    else if (this.req.headers["x-broker"] == "flex-combo") {
      return false;
    }

    var protocol = (this.req.connection.encrypted ? "https" : "http") + ':';
    var H = this.req.headers.host.split(':');
    var reqPort = H[1] || (protocol == "https:" ? 443 : 80);
    var reqHostName = H[0];
    var reqHostIP = reqHostName;
    if (this.param.hostIp) {
      reqHostIP = this.param.hostIp;
    }
    else if (this.param.hosts && this.param.hosts[reqHostName]) {
      reqHostIP = this.param.hosts[reqHostName];
    }

    var requestOption = {
      protocol: protocol,
      host: reqHostIP,
      port: reqPort,
      path: url,
      method: this.req.method || "GET",
      rejectUnauthorized: false,
      headers: {
        "x-broker": "flex-combo",
        host: reqHostName,
        cookie: this.req.headers.cookie || ''
      }
    };
    requestOption.headers = merge.recursive(true, this.param.headers || {}, requestOption.headers);

    return requestOption;
  },
  filteredUrl: function (_url, isTrace) {
    var _filter = this.param.filter || {};
    var jsonstr = JSON.stringify(_filter).replace(/\\{2}/g, '\\');
    var filter = [];
    jsonstr.replace(/[\{\,]"([^"]*?)"/g, function (all, key) {
      filter.push(key);
    });

    var regx, ori_url;
    for (var k = 0, len = filter.length; k < len; k++) {
      regx = new RegExp(filter[k]);
      if (regx.test(_url)) {
        ori_url = _url;
        _url = _url.replace(regx, _filter[filter[k]]);
        if (isTrace) {
          this.trace.filter(regx, ori_url, _url);
        }
      }
    }
    return _url;
  },
  getRealPath: function (_url) {
    var map = this.param.urls || {};
    _url = (/^\//.test(_url) ? '' : '/') + _url;

    // urls中key对应的实际目录
    var repPath = '', revPath = _url, longestMatchNum = 0;
    for (var k in map) {
      if (_url.indexOf(k) == 0 && longestMatchNum < k.length) {
        longestMatchNum = k.length;
        repPath = map[k];
        revPath = _url.slice(longestMatchNum);
      }
    }

    return pathLib.normalize(pathLib.join(repPath, revPath));
  },
  engineHandler: function (_url, next) {
    var eUrl = _url;
    // .css找不到尝试找.less
    if (!/\.less/.test(_url)) {
      eUrl = _url.replace(/\.css$/, ".less.css");
    }
    var filteredURL = this.filteredUrl(eUrl, true);
    var absPath = this.getRealPath(filteredURL);

    var matchedIndex = -1;
    for (var i = this.engines.length - 1, matched = null, matchedNum = -1; i >= 0; i--) {
      matched = filteredURL.match(new RegExp(this.engines[i].rule));
      if (matched && matched[0].length > matchedNum && typeof this.engines[i].func == "function") {
        matchedNum = matched[0].length;
        matchedIndex = i;
      }
    }

    if (!this.result[_url] && matchedIndex >= 0 && this.engines[matchedIndex]) {
      var engine = this.engines[matchedIndex];
      this.query = merge.recursive(true, this.param[engine.path] || {}, this.query);

      engine.func(absPath, this.buildRequestOption(filteredURL), this.query, function (e, result, realPath, MIME) {
        if (!e) {
          this.MIME = MIME;
          this.result[_url] = this.convert(result, _url);
          this.trace.engine(filteredURL, realPath || absPath);
        }
        next();
      }.bind(this));
    }
    else {
      next();
    }
  },
  staticHandler: function (_url, next) {
    var filteredURL = this.filteredUrl(_url, false);
    var absPath = this.getRealPath(filteredURL);

    if (!this.result[_url]) {
      if (fsLib.existsSync(absPath)) {
        var buff = fsLib.readFileSync(absPath);

        if (!Helper.isBinFile(absPath)) {
          buff = this.convert(buff, _url);
        }

        this.result[_url] = buff;
        this.trace.local(filteredURL, absPath);
      }
      else {
        if (/^\/favicon\.ico$/.test(_url)) {
          this.result[_url] = fsLib.readFileSync(pathLib.join(__dirname, "assets/favicon.ico"));
        }
        else {
          this.trace.warn(absPath, "Not in Local");
        }
      }
    }

    next();
  },
  cacheHandler: function (_url, next) {
    var absPath = this.getCacheFilePath(_url);

    if (absPath && !this.result[_url] && fsLib.existsSync(absPath)) {
      this.result[_url] = fsLib.readFileSync(absPath);
      this.trace.cache(_url, absPath);
    }

    next();
  },
  fetchHandler: function (_url, next) {
    if (!this.result[_url]) {
      var self = this;
      var requestOption = this.buildRequestOption(_url);
      if (requestOption) {
        fetch.request(requestOption, function (e, buff, nsres) {
          var remoteURL = self.HOST + _url;
          var tips;
          if (e) {
            tips = remoteURL + " Request Error!";
            self.result[_url] = new Buffer("/* " + tips + " */");
            self.trace.error(tips, "Network 500");
            next(null, 500);
          }
          else {
            if (nsres.statusCode == 404) {
              tips = remoteURL + ' ' + nsres.statusMessage + '!';
              if (/^image\//.test(self.MIME)) {
                self.result[_url] = fsLib.readFileSync(pathLib.join(__dirname, "assets/404.jpg"));
              }
              else {
                self.result[_url] = new Buffer("/* " + tips + " */");
              }
              self.trace.error(tips, "Network 404");
              next(null, 404);
            }
            else {
              self.cacheFile(_url, buff);
              self.result[_url] = buff;
              self.trace.remote(self.HOST + _url, requestOption.host);
              next();
            }
          }
        });
      }
      else {
        this.result[_url] = new Buffer("/* " + _url + " is NOT FOUND in Local, and flex-combo doesn't know the URL where the online assets exist! */");
        this.trace.error("Can't build RequestOption for " + _url + '!', "Loop");
        next(null, 404);
      }
    }
    else {
      next();
    }
  },
  init: function (req, res) {
    this.req = req;
    this.res = res;

    this.query = merge.recursive(true, this.query, req.body || {}, req.query || {});

    this.HOST = (req.connection.encrypted ? "https" : "http") + "://" + (req.hostname || req.host || req.headers.host);
    // 不用.pathname的原因是由于??combo形式的url，parse方法解析有问题
    this.URL = urlLib.parse(req.url).path
      .replace(/([^\?])\?[^\?].*$/, "$1")
      .replace(/[\?\,]{1,}$/, '');
    this.MIME = mime.lookup(this.URL);

    var suffix = ["\\.js$", "\\.css$", "\\.webp$", "\\.png$", "\\.gif$", "\\.jpg$", "\\.jpeg$", "\\.ico$", "\\.swf$", "\\.xml$", "\\.json$", "\\.less$", "\\.scss$", "\\.svg$", "\\.ttf$", "\\.eot$", "\\.woff$", "\\.mp3$", "\\.zip$"];
    var supportedFile = this.param.supportedFile;
    if (supportedFile) {
      suffix = suffix.concat(supportedFile.split('|'));
    }

    var engines = this.param.engine || {};
    var regx, path, mod;
    for (var k in engines) {
      regx = new RegExp(k);
      path = this.URL.replace(regx, engines[k]);
      if (regx.test(this.URL)) {
        suffix.push(k);

        mod = pathLib.join(process.cwd(), path);
        if (fsLib.existsSync(mod) || fsLib.existsSync(mod + ".js")) {
          this.addEngine(k, require(mod), path, true);
          delete require.cache[mod];
          delete require.cache[mod + ".js"];
        }

        this.param.urls[pathLib.dirname(this.URL)] = pathLib.dirname(mod);
      }
    }

    for (var i = 0, len = this.engines.length; i < len; i++) {
      suffix.push(this.engines[i].rule);
    }
    suffix = Helper.unique(suffix);

    return new RegExp(suffix.join('|')).test(this.URL);
  },
  stream: function (absPath, cb) {
    var _url = absPath.replace(this.param.rootdir, '');
    this.trace.request(this.param.rootdir, _url);
    this.engineHandler(_url, function () {
      cb(this.result[_url]);
      this.trace.response(absPath);
    }.bind(this));
  },
  handle: function (req, res, next) {
    if (this.init(req, res)) {
      var files = this.parser(this.URL);
      var FLen = files.length;
      var self = this;
      var Q = [];

      this.trace.request(this.HOST, files);

      var tmpFile;
      for (var i = 0; i < FLen; i++) {
        tmpFile = files[i];
        Q.push(
          (function (f) {
            return function (cb) {
              self.engineHandler(f, cb);
            }
          })(tmpFile),
          (function (f) {
            return function (cb) {
              self.staticHandler(f, cb);
            }
          })(tmpFile),
          (function (f) {
            return function (cb) {
              self.cacheHandler(f, cb);
            }
          })(tmpFile),
          (function (f) {
            return function (cb) {
              self.fetchHandler(f, cb);
            }
          })(tmpFile)
        );
      }

      async.series(Q, function (e, responseData) {
        responseData = Helper.unique(responseData);

        res.writeHead(responseData[0] || 200, {
          "Access-Control-Allow-Origin": '*',
          "Content-Type": this.MIME + (Helper.isBinFile(this.URL) ? '' : ";charset=" + this.param.charset),
          "X-MiddleWare": "flex-combo"
        });

        var fileURI, fileBuff, buffArr = [];
        for (var i = 0; i < FLen; i++) {
          fileURI = files[i];
          fileBuff = this.result[fileURI] ? this.result[fileURI] : new Buffer("/* " + fileURI + " Empty!*/");
          res.write(fileBuff);
          res.write("\n");
          buffArr.push(fileBuff);
        }

        if (
          files.length > 1
          && /[\?&]_sourcemap\b/.test(req.url)
          && ["application/javascript", "text/css"].indexOf(this.MIME) != -1
        ) {
          res.write(require("./lib/sourcemap")(
            this.result,
            files,
            (this.MIME == "application/javascript" ? "js" : "css")
          ));
        }

        res.end();
        this.trace.response(this.HOST + req.url, Buffer.concat(buffArr));
      }.bind(this));
    }
    else {
      next();
    }
  },
  convert: function (buff, _url) {
    var outputCharset = (this.param.charset || "utf-8").toLowerCase();
    if (this.param.urlBasedCharset && _url && this.param.urlBasedCharset[_url]) {
      outputCharset = this.param.urlBasedCharset[_url];
    }

    return Helper.getBuffer(buff, outputCharset);
  },
  getCacheFilePath: function (_url) {
    if (this.cacheDir) {
      return pathLib.join(this.cacheDir, Helper.MD5(pathLib.join(this.HOST, _url)));
    }
    else {
      return false;
    }
  },
  cacheFile: function (_url, buff) {
    var absPath = this.getCacheFilePath(_url);
    if (absPath && !/[<>\*\?]+/g.test(absPath)) {
      fsLib.writeFile(absPath, buff, function (e) {
        if (!e) {
          fsLib.chmod(absPath, 0777);
        }
      });
    }
  }
};

module.exports = FlexCombo;
