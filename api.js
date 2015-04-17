var urlLib = require("url");
var pathLib = require("path");
var fsLib = require("fs");
var mime = require("mime");
var async = require("async");
var mkdirp = require("mkdirp");
var merge = require("merge");
var fetch = require("fetch-agent");
var DAC = require("dac");
var isUtf8 = DAC.isUtf8;
var iconv = DAC.iconv;

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
  this.param = merge(true, require("./lib/param"));
  this.query = {};
  this.result = {};
  this.cacheDir = null;

  if (confFile) {
    this.cacheDir = pathLib.join(pathLib.dirname(confFile), "../.cache");

    var confJSON = {};
    try {
      confJSON = JSON.parse(fsLib.readFileSync(confFile));
    }
    catch (e) {
      Helper.Log.error("Params Error!");
      confJSON = {};
    }
    this.param = merge.recursive(true, this.param, confJSON, param || {});

    if (confJSON.filter || param.filter) {
      this.param.filter = merge(confJSON.filter || {}, param.filter || {});
    }
  }
  else {
    this.param = merge.recursive(true, this.param, param || {});
  }

  var root = this.param.rootdir || "src";
  if (root.indexOf('/') == 0 || /^\w{1}:\\.*$/.test(root)) {
    this.param.rootdir = pathLib.normalize(root);
  }
  else {
    this.param.rootdir = pathLib.normalize(pathLib.join(process.cwd(), root));
  }

  if (!this.param.urls['/']) {
    this.param.urls['/'] = this.param.rootdir;
  }

  if (!this.cacheDir) {
    this.cacheDir = pathLib.join(this.param.rootdir, "../.cache");
  }
  if (this.param.cache && !fsLib.existsSync(this.cacheDir)) {
    mkdirp(this.cacheDir, function(e, dir) {
      fsLib.chmod(dir, 0777);
    });
  }

  this.param.traceRule = new RegExp(this.param.traceRule, 'i');
};
FlexCombo.prototype = {
  constructor: FlexCombo,
  parser: function (_url) {
    var url = urlLib.parse(_url).path.replace(/\\|\/{1,}/g, '/');
    var prefix = url.indexOf(this.param.servlet + '?');

    if (prefix != -1) {
      var base = url.slice(0, prefix);
      var file = url.slice(prefix + this.param.servlet.length + 1);
      var filelist = file.split(this.param.seperator, 1000);
      return filelist.map(function (i) {
        return pathLib.join(base, i);
      });
    }
    else {
      return [url];
    }
  },
  defineParser: function (func) {
    if (typeof func == "function") {
      FlexCombo.prototype.parser = func;
    }
  },
  addEngine: function (rule, func, p, realtime) {
    if (rule && typeof func == "function") {
      (realtime ? this.engines : ENGINES).push({
        rule: rule,
        func: func,
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
  init: function (req, res) {
    this.req = req;
    this.res = res;

    this.query = merge.recursive(true, this.query, req.body || {}, req.query || {});

    this.HOST = (req.connection.encrypted ? "https" : "http") + "://" + (req.hostname || req.host || req.headers.host);
    // 不用.pathname的原因是由于??combo形式的url，parse方法解析有问题
    this.URL = urlLib.parse(req.url).path.replace(/([^\?])\?[^\?].*$/, "$1");
    this.MIME = mime.lookup(this.URL);

    var suffix = ["\\.tpl$", "\\.phtml$", "\\.js$", "\\.css$", "\\.png$", "\\.gif$", "\\.jpg$", "\\.jpeg$", "\\.ico$", "\\.swf$", "\\.xml$", "\\.less$", "\\.scss$", "\\.svg$", "\\.ttf$", "\\.eot$", "\\.woff$", "\\.mp3$"];
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

        this.param.urls[pathLib.dirname(this.URL)] = pathLib.dirname(path);

        mod = pathLib.join(process.cwd(), path);
        if (fsLib.existsSync(mod) || fsLib.existsSync(mod + ".js")) {
          this.addEngine(k, require(mod), path, true);
        }
      }
    }

    for (var i = 0, len = this.engines.length; i < len; i++) {
      suffix.push(this.engines[i].rule);
    }

    suffix = suffix.filter(function (elem, pos) {
      return suffix.indexOf(elem) == pos;
    });

    return new RegExp(suffix.join('|')).test(this.URL);
  },
  engineHandler: function (_url, next) {
    var filteredURL = Helper.filteredUrl(_url, this.param.filter, this.param.traceRule);
    var absPath = Helper.getRealPath(filteredURL, this.param.urls);

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
          if (this.param.traceRule && this.param.traceRule.test("Engine " + filteredURL + (realPath || absPath))) {
            Helper.Log.engine(filteredURL, realPath || absPath);
          }
        }
        next();
      }.bind(this));
    }
    else {
      next();
    }
  },
  staticHandler: function (_url, next) {
    var filteredURL = Helper.filteredUrl(_url, this.param.filter, false);
    var absPath = Helper.getRealPath(filteredURL, this.param.urls);

    if (!this.result[_url]) {
      if (fsLib.existsSync(absPath)) {
        var buff = fsLib.readFileSync(absPath);

        if (!Helper.isBinFile(absPath)) {
          buff = this.convert(buff, _url);
        }

        this.result[_url] = buff;
        if (this.param.traceRule && this.param.traceRule.test("Local " + filteredURL + absPath)) {
          Helper.Log.local(filteredURL, absPath);
        }
      }
      else {
        if (/^\/favicon\.ico$/.test(_url)) {
          this.result[_url] = fsLib.readFileSync(pathLib.join(__dirname, "assets/favicon.ico"));
        }
        else {
          Helper.Log.warn(absPath, "Not Found!");
        }
      }
    }

    next();
  },
  cacheHandler: function (_url, next) {
    var absPath = this.getCacheFilePath(_url);

    if (absPath && !this.result[_url] && fsLib.existsSync(absPath)) {
      this.result[_url] = fsLib.readFileSync(absPath);
      if (this.param.traceRule && this.param.traceRule.test("Cache " + _url + absPath)) {
        Helper.Log.cache(_url, absPath);
      }
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
            tips = remoteURL + " Fetch Error!";
            self.result[_url] = new Buffer("/* " + tips + " */");
            Helper.Log.error(tips);
            next(500);
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
              Helper.Log.error(tips);
              next(404);
            }
            else {
              self.cacheFile(_url, buff);
              self.result[_url] = buff;
              if (self.param.traceRule && self.param.traceRule.test("Remote " + _url)) {
                Helper.Log.remote(_url, requestOption);
              }
              next();
            }
          }
        });
      }
      else {
        this.result[_url] = new Buffer("/* " + _url + " is NOT FOUND in Local, and flex-combo doesn't know the URL where the online assets exist! */");
        Helper.Log.error(_url + " Not Found!");
        next(404);
      }
    }
    else {
      next();
    }
  },
  handle: function (req, res, next) {
    if (this.init(req, res)) {
      var files = this.parser(this.URL);
      var FLen = files.length;
      var self = this;
      var Q = [];

      if (this.param.traceRule && this.param.traceRule.test("Request " + this.HOST + files.join(' '))) {
        Helper.Log.request(this.HOST, files);
      }

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

      async.series(Q, function (statusCode) {
        this.res.writeHead(statusCode || 200, {
          "Access-Control-Allow-Origin": '*',
          "Content-Type": this.MIME + (Helper.isBinFile(this.URL) ? '' : ";charset=" + this.param.charset),
          "X-MiddleWare": "flex-combo"
        });

        var buff;
        for (var i = 0; i < FLen; i++) {
          buff = this.result[files[i]];
          res.write(buff ? buff : new Buffer("/* " + files[i] + " Empty!*/"));
        }
        var resurl = this.HOST + req.url;
        if (this.param.traceRule && this.param.traceRule.test("Response " + resurl)) {
          Helper.Log.response(resurl);
        }
        res.end();
      }.bind(this));
    }
    else {
      next();
    }
  },
  convert: function (buff, _url) {
    if (!Buffer.isBuffer(buff)) {
      buff = new Buffer(buff);
    }

    var selfCharset = isUtf8(buff) ? "utf-8" : "gbk";

    var outputCharset = (this.param.charset || "utf-8").toLowerCase();
    if (this.param.urlBasedCharset && _url && this.param.urlBasedCharset[_url]) {
      outputCharset = this.param.urlBasedCharset[_url];
    }

    if (selfCharset == outputCharset) {
      return buff;
    }
    else {
      return iconv.encode(iconv.decode(buff, selfCharset), outputCharset);
    }
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
      fsLib.writeFile(absPath, buff, function(e) {
        if (!e) {
          fsLib.chmod(absPath, 0777);
        }
      });
    }
  }
};

module.exports = FlexCombo;
