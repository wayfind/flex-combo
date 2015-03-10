var urlLib = require("url");
var pathLib = require("path");
var fsLib = require("fs");
var mime = require("mime");
var async = require("async");
var isUtf8 = require("is-utf8");
var iconv = require("iconv-lite");
var Helper = require("./lib/util");
var ALProtocol = {
  "http:": require("http"),
  "https:": require("https")
};

function FlexCombo(param, dir) {
  this.HOST = null;
  this.URL = null;
  this.MIME = null;
  this.req = null;
  this.res = null;
  this.param = Helper.clone(require("./lib/param"));
  this.cacheDir = null;
  this.result = {};

  if (dir) {
    var confFile = '';
    if (dir && (/^\//.test(dir) || /^\w{1}:[\\|\/].*$/.test(dir))) {
      confFile = pathLib.join(dir, "config.json");
    }
    else {
      confFile = pathLib.join(process.cwd(), dir || ".config", pathLib.basename(__dirname) + ".json");
    }

    var confDir = pathLib.dirname(confFile);
    if (!fsLib.existsSync(confDir)) {
      Helper.mkdirPSync(confDir);
      fsLib.chmod(confDir, 0777);
    }

    if (!fsLib.existsSync(confFile)) {
      fsLib.writeFileSync(confFile, JSON.stringify(this.param, null, 2), {encoding: "utf-8"});
      fsLib.chmod(confFile, 0777);
    }

    var confJSON = {};
    try {
      confJSON = JSON.parse(fsLib.readFileSync(confFile));
    }
    catch (e) {
      Helper.Log.error("Params Error!");
      confJSON = {};
    }
    this.param = Helper.merge(true, this.param, confJSON, param || {});

    if (confJSON.filter || param.filter) {
      this.param.filter = Helper.merge(confJSON.filter || {}, param.filter || {});
    }

    if (this.param.cache) {
      this.cacheDir = pathLib.join(confDir, "../.cache");
      if (!fsLib.existsSync(this.cacheDir)) {
        Helper.mkdirPSync(this.cacheDir);
        fsLib.chmod(this.cacheDir, 0777);
      }
    }
  }
  else {
    this.param = Helper.merge(true, this.param, param || {});
  }

  if (!this.param.urls['/']) {
    this.param.urls['/'] = this.param.rootdir || "src";
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
        return pathLib.join(base, i).replace(/\\|\/{1,}/g, '/');
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
  engines: [],
  addEngine: function (rule, func) {
    if (rule && typeof func == "function") {
      FlexCombo.prototype.engines.push({
        rule: rule,
        func: func
      });
    }
  },
  init: function (req, res) {
    this.req = req;
    this.res = res;

    this.HOST = (req.protocol || "http") + "://" + (req.hostname || req.host || req.headers.host);
    // 不用.pathname的原因是由于??combo形式的url，parse方法解析有问题
    this.URL = urlLib.parse(req.url).path.replace(/([^\?])\?[^\?].*$/, "$1");

    var suffix = ["\\.jpl$", "\\.phtml$", "\\.js$", "\\.css$", "\\.png$", "\\.gif$", "\\.jpg$", "\\.jpeg$", "\\.ico$", "\\.swf$", "\\.xml$", "\\.less$", "\\.scss$", "\\.svg$", "\\.ttf$", "\\.eot$", "\\.woff$", "\\.mp3$"];
    var supportedFile = this.param.supportedFile;
    if (supportedFile) {
      suffix = suffix.concat(supportedFile.split('|'));
    }

    var engines = this.param.engine || {};
    for (var k in engines) {
      suffix.push(k);
      if (this.URL.match(new RegExp(k))) {
        this.param.urls[pathLib.dirname(this.URL)] = pathLib.dirname(engines[k]);
      }
      this.addEngine(k, require(pathLib.join(process.cwd(), engines[k])));
    }
    for (var i = 0, len = this.engines.length; i < len; i++) {
      suffix.push(this.engines[i].rule);
    }

    suffix = suffix.filter(function (elem, pos) {
      return suffix.indexOf(elem) == pos;
    });

    return this.URL.match(new RegExp(suffix.join('|'))) ? true : false;
  },
  convert: function (content, _url) {
    var buff = content;
    if (typeof content != "object" || !Buffer.isBuffer(content)) {
      buff = new Buffer(content);
    }

    var charset = isUtf8(buff) ? "utf-8" : "gbk";
    var outputCharset = (this.param.charset).toLowerCase();

    if (this.param.urlBasedCharset && _url && this.param.urlBasedCharset[_url]) {
      outputCharset = this.param.urlBasedCharset[_url];
    }

    if (charset == outputCharset) {
      return buff;
    }

    return iconv.encode(
      (typeof buff == "string") ? buff : iconv.decode(buff, charset),
      outputCharset
    );
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
      fsLib.writeFile(absPath, buff);
    }
  },
  buildRequestOption: function (url) {
    if (this.req.headers["x-broker"] == "flex-combo") {
      return false;
    }

    var protocol = (this.req.protocol || "https") + ':';
    var H = this.req.headers.host.split(':');
    var reqPort = H[1] || (protocol == "https:" ? 443 : 80);
    var reqHostName = H[0];
    var reqHostIP;
    if (this.param.hostIp) {
      reqHostIP = this.param.hostIp;
    }
    else if (this.param.hosts && this.param.hosts[reqHostName]) {
      reqHostIP = this.param.hosts[reqHostName];
    }
    else {
      reqHostIP = reqHostName;
    }

    if (reqHostIP == reqHostName && this.req.url.match(/favicon\.ico$/)) {
      return false;
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
        host: reqHostName
      }
    };
    requestOption.headers = Helper.merge(true, this.param.headers, requestOption.headers);

    return requestOption;
  },
  engineHandler: function (_url, next) {
    var filteredURL = Helper.filteredUrl(_url, this.param.filter, this.param.traceRule);
    var absPath = Helper.getRealPath(filteredURL, this.param.filter, this.param.urls);

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
      engine.func(absPath, filteredURL, this.param, function (e, result, realPath, MIME) {
        if (!e) {
          this.MIME = MIME;

          this.result[_url] = this.convert(result, _url);
          if (("Engine " + filteredURL + (realPath || absPath)).match(this.param.traceRule)) {
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
    var absPath = Helper.getRealPath(filteredURL, this.param.filter, this.param.urls);

    if (!this.result[_url] && fsLib.existsSync(absPath)) {
      var buff = fsLib.readFileSync(absPath);

      if (!Helper.isBinFile(absPath)) {
        buff = this.convert(buff, _url);
      }

      this.result[_url] = buff;
      if (("Local " + filteredURL + absPath).match(this.param.traceRule)) {
        Helper.Log.local(filteredURL, absPath);
      }
    }

    next();
  },
  cacheHandler: function (_url, next) {
    var absPath = this.getCacheFilePath(_url);

    if (absPath && !this.result[_url] && fsLib.existsSync(absPath)) {
      this.result[_url] = fsLib.readFileSync(absPath);
      if (("Cache " + _url + absPath).match(this.param.traceRule)) {
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
        ALProtocol[requestOption.protocol]
          .request(requestOption, function (nsres) {
            var buffer = [];
            nsres
              .on("error", function () {
                self.result[_url] = new Buffer("/* " + _url + " Fetch ERROR! */");
                Helper.Log.error(_url);
                next();
              })
              .on("data", function (chunk) {
                buffer.push(chunk);
              })
              .on("end", function () {
                var buff = Helper.joinBuffer(buffer);
                self.cacheFile(_url, buff);
                self.result[_url] = buff;
                if (("Remote " + _url).match(self.param.traceRule)) {
                  Helper.Log.remote(_url, requestOption);
                }
                next();
              });
          })
          .on("error", function () {
            self.result[_url] = new Buffer("/* " + _url + " Request ERROR! */");
            Helper.Log.error(_url);
            next();
          })
          .end();
      }
      else {
        if (_url.match(/favicon\.ico$/)) {
          this.result[_url] = fsLib.readFileSync(pathLib.join(__dirname, "bin/favicon.ico"));
        }
        else {
          this.result[_url] = new Buffer("/* " + _url + " is NOT FOUND in Local, and flex-combo doesn't know the URL where the online assets exist! */");
          Helper.Log.error(_url);
        }
        next();
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

      if (("Request " + this.HOST + files.join(' ')).match(this.param.traceRule)) {
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

      async.series(Q, function () {
        this.res.writeHead(200, {
          "Access-Control-Allow-Origin": '*',
          "Content-Type": (this.MIME || mime.lookup(this.URL)) + (Helper.isBinFile(this.URL) ? '' : ";charset=" + this.param.charset),
          "X-MiddleWare": "flex-combo"
        });

        var buff;
        for (var i = 0; i < FLen; i++) {
          buff = this.result[files[i]];
          res.write(buff ? buff : new Buffer("/* " + files[i] + " Empty!*/"));
        }
        var resurl = this.HOST + req.url;
        if (("Response " + resurl).match(this.param.traceRule)) {
          Helper.Log.response(resurl);
        }
        res.end();
      }.bind(this));
    }
    else {
      next();
    }
  }
};

module.exports = FlexCombo;