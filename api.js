var urlLib = require("url");
var pathLib = require("path");
var fsLib = require("fs");
var mime = require("mime");
var async = require("async");
var isUtf8 = require("is-utf8");
var iconv = require("iconv-lite");
var utilLib = require("mace")(module);
var helper = require("./lib/util");

var ALProtocol = {
  "http:": require("http"),
  "https:": require("https")
};

var Log = (function () {
  var colors = {
    bold: [ 1, 22 ],
    italic: [ 3, 23 ],
    underline: [ 4, 24 ],
    inverse: [ 7, 27 ],
    white: [ 37, 39 ],
    grey: [ 89, 39 ],
    black: [ 30, 39 ],
    blue: [ 34, 39 ],
    cyan: [ 36, 39 ],
    green: [ 32, 39 ],
    magenta: [ 35, 39 ],
    red: [ 31, 39 ],
    yellow: [ 33, 39 ]
  };

  function colorFull (color, str, style, wrap) {
    var prefix = '\x1B[';

    return [
      wrap ? '·'+new Array(10-str.length).join(' ') : '',
      style ? (prefix + style[0] + 'm') : '',
      prefix, color[0], 'm',

      str,
      prefix, color[1], 'm',
      style ? (prefix + style[1] + 'm') : '',
      wrap ? ' ' : ''
    ].join('');
  }

  function typing(type, url, input) {
    utilLib.logue("%s " + url + " %s %s", '[' + type + ']', "<=", input);
  }

  return {
    request: function (host, files) {
      utilLib.info("=> %s %o", host, files);
    },
    response: function (input) {
      utilLib.done("<= %s\n", input);
    },
    warn: function (input, reason) {
      utilLib.logue("%s " + input + " %s", "[Warn]", reason || "Exception");
    },
    error: function (input) {
      utilLib.logue("%s %s", colorFull(colors.red, "[Error]", colors.inverse), colorFull(colors.red, input));
    },
    local: function (url, input) {
      typing("Local", url, input);
    },
    engine: function (url, input) {
      typing("Engine", url, input);
    },
    cache: function (url, input) {
      typing("Cache", url, input);
    },
    remote: function (url, opt) {
      opt = utilLib.merge(true, {
        protocol: "http:",
        host: "127.0.0.1",
        path: "/fake",
        port: 80,
        headers: {
          host: "localhost"
        }
      }, opt);
      typing("Remote", url, opt.protocol + "//" + opt.headers.host + ':' + opt.port + opt.path + " (IP:" + opt.host + ')');
    }
  }
})();

/* 是否为二进制文件 */
function isBinFile(filePath) {
  return !/.js$|.css$|.less$|.scss$|.sass$/.test(filePath);
}

/* 以配置文件指定编码输出encoded buffer */
function convert(content, _url) {
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
}

/* 缓存文件 */
function cacheFile(_url, buff) {
  var absPath = pathLib.join(this.cacheDir, utilLib.MD5(pathLib.join(this.HOST, _url)));
  if (!/[<>\*\?]+/g.test(absPath)) {
    fsLib.writeFile(absPath, buff);
  }
}

/* 构建Request头 */
function buildRequestOption(url) {
  var protocol = (this.req.protocol || "http") + ':';

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

  var requestOption = {
    protocol: protocol,
    host: reqHostIP,
    port: reqPort,
    path: url,
    method: this.req.method || "GET",
    headers: {host: reqHostName}
  };
  requestOption.headers = utilLib.merge(true, this.param.headers, requestOption.headers);

  if (reqHostIP == reqHostName) {
    return false;
  }
  return requestOption;
}

/* LESS动态编译 */
function lessCompiler(xcssfile, url, param, cb) {
  return require("./engines/less")(xcssfile, url, param, cb);
}

/* SASS动态编译 */
function sassCompiler(xcssfile, url, param, cb) {
  return require("./engines/sass")(xcssfile, url, param, cb);
}

/* TPL动态编译 */
function jplCompiler(htmlfile, url, param, cb) {
  return require("./engines/jpl")(htmlfile, url, param, cb);
}

/**
 * FlexCombo类
 */
function FlexCombo(param, dir) {
  this.HOST     = null;
  this.URL      = null;
  this.req      = null;
  this.res      = null;
  this.cacheDir = null;
  this.param    = utilLib.clone(require("./lib/param"));
  this.result   = {};

  var confFile = '';
  if (dir && (/^\//.test(dir) || /^\w{1}:[\\|\/].*$/.test(dir))) {
    confFile = pathLib.join(dir, "config.json");
  }
  else {
    var moduleName = pathLib.basename(__dirname);
    confFile = pathLib.join(process.cwd(), dir || ('.' + moduleName), moduleName + ".json");
  }

  var confDir = pathLib.dirname(confFile);
  if (!fsLib.existsSync(confDir)) {
    utilLib.mkdirPSync(confDir);
  }

  if (!fsLib.existsSync(confFile)) {
    fsLib.writeFileSync(confFile, JSON.stringify(this.param, null, 2), {encoding: "utf-8"});
  }

  var confJSON = {};
  try {
    confJSON = JSON.parse(fsLib.readFileSync(confFile));
  }
  catch (e) {
    Log.error("Params Error!");
    confJSON = {};
  }
  this.param = utilLib.merge(true, this.param, confJSON, param||{});

  this.cacheDir = pathLib.join(confDir, "../.cache");
  if (!fsLib.existsSync(this.cacheDir)) {
    utilLib.mkdirPSync(this.cacheDir);
  }
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
  engines: [
    {
      rule: "\\.less$",
      func: lessCompiler
    },
    {
      rule: "\\.less\\.css$",
      func: lessCompiler
    },
    {
      rule: "\\.scss$",
      func: sassCompiler
    },
    {
      rule: "\\.scss\\.css$",
      func: sassCompiler
    },
    {
      rule: "\\.jpl$",
      func: jplCompiler
    },
    {
      rule: "\\.html\\.js$",
      func: function (htmlfile, url, param, cb) {
        jplCompiler(htmlfile, url, param, function(e, content) {
          fsLib.writeFile(htmlfile, convert.call(this, content));
          cb(e, content);
        });
      }
    }
  ],
  addEngine: function (rule, func) {
    if (rule && typeof func == "function") {
      this.engines.push({
        rule: rule,
        func: func
      });
    }
  },
  init: function(req, res) {
    this.req = req;
    this.res = res;

    this.HOST = (req.protocol||"http") + "://" + (req.hostname||req.host||req.headers.host);
    // 不用.pathname的原因是由于??combo形式的url，parse方法解析有问题
    this.URL  = urlLib.parse(req.url).path.replace(/([^\?])\?[^\?].+$/, "$1");

    var suffix = ["\\.jpl$", "\\.phtml$","\\.js$","\\.css$","\\.png$","\\.gif$","\\.jpg$","\\.jpeg$","\\.ico$","\\.swf$","\\.xml$","\\.less$","\\.scss$","\\.svg$","\\.ttf$","\\.eot$","\\.woff$","\\.mp3$"];
    var supportedFile = this.param.supportedFile;
    if (supportedFile) {
      suffix = supportedFile.split('|');
    }
    var engines = this.param.engine || {};
    for (var k in engines) {
      suffix.push(k);
      if (this.URL.match(new RegExp(k))) {
        this.param.urls[pathLib.dirname(this.URL)] = pathLib.dirname(engines[k]);
      }
      this.addEngine(k, require(pathLib.join(process.cwd(), engines[k])));
    }

    return this.URL.match(new RegExp(suffix.join('|'))) ? true : false;
  },
  header: function() {
    var U4M = this.URL;
    if (U4M.match(/\.less$|\.scss$|\.sass$/)) {
      U4M += ".css";
    }
    else if (U4M.match(/\.jpl$/)) {
      U4M += ".js";
    }
    this.res.writeHead(200, {
      "Access-Control-Allow-Origin": '*',
      "Content-Type": mime.lookup(U4M) + (isBinFile(U4M) ? '' : ";charset=" + this.param.charset),
      "X-MiddleWare": "flex-combo"
    });
  },
  engineHandler: function(_url, next) {
    var absPath = helper.getRealPath(_url, this.param.filter, this.param.urls, this.param.debug);

    var matchedIndex = -1;
    for (var i = this.engines.length - 1, matched = null, matchedNum = -1; i >= 0; i--) {
      matched = _url.match(new RegExp(this.engines[i].rule));
      if (matched && matched[0].length > matchedNum && typeof this.engines[i].func == "function") {
        matchedNum = matched[0].length;
        matchedIndex = i;
      }
    }

    if (!this.result[_url] && matchedIndex >= 0 && this.engines[matchedIndex]) {
      var engine = this.engines[matchedIndex];
      var self = this;
      engine.func(absPath, _url, this.param, function(e, result, realPath) {
        self.result[_url] = convert.call(self, result, _url);

        self.param.debug && Log.engine(_url, realPath||absPath);
        next();
      });
    }
    else {
      next();
    }
  },
  staticHandler: function(_url, next) {
    var absPath = helper.getRealPath(_url, this.param.filter, this.param.urls, false);

    if (!this.result[_url] && fsLib.existsSync(absPath)) {
      var buff = fsLib.readFileSync(absPath);

      if (!isBinFile(absPath)) {
        buff = convert.call(this, buff, _url);
      }

      this.result[_url] = buff;
      this.param.debug && Log.local(_url, absPath);
    }

    next();
  },
  cacheHandler: function(_url, next) {
    var absPath = pathLib.join(this.cacheDir, utilLib.MD5(pathLib.join(this.HOST, _url)));

    if (!this.result[_url] && fsLib.existsSync(absPath)) {
      this.result[_url] = fsLib.readFileSync(absPath);
      this.param.debug && Log.cache(_url, absPath);
    }

    next();
  },
  fetchHandler: function(_url, next) {
    if (!this.result[_url]) {
      var self = this;
      var requestOption = buildRequestOption.call(this, _url);
      if (requestOption) {
        ALProtocol[requestOption.protocol]
          .request(requestOption, function (nsres) {
            var buffer = [];
            nsres
              .on("error", function () {
                self.result[_url] = new Buffer("/* " + _url + " Proxy ERROR! */");
                Log.error(_url);
                next();
              })
              .on("data", function (chunk) {
                buffer.push(chunk);
              })
              .on("end", function () {
                var buff = utilLib.joinBuffer(buffer);
                cacheFile.call(self, _url, buff);
                self.result[_url] = buff;
                Log.remote(_url, requestOption);
                next();
              });
          })
          .on("error", function () {
            self.result[_url] = new Buffer("/* " + _url + " Req ERROR! */");
            Log.error(_url);
            next();
          })
          .end();
      }
      else {
        self.result[_url] = new Buffer("/* " + _url + " Loop! */");
        Log.error(_url);
        next();
      }
    }
    else {
      next();
    }
  },
  handle: function (req, res, next) {
    if (this.init(req, res)) {
      this.header();

      var files = this.parser(this.URL);
      var FLen  = files.length;
      var self  = this;
      var Q     = [];

      Log.request(this.HOST, files);

      for (var i = 0; i < FLen; i++) {
        Q.push(
          (function(i){
            return function(cb) {
              self.engineHandler(files[i], cb);
            }
          })(i),
          (function(i){
            return function(cb) {
              self.staticHandler(files[i], cb);
            }
          })(i),
          (function(i){
            return function(cb) {
              self.cacheHandler(files[i], cb);
            }
          })(i),
          (function(i){
            return function(cb) {
              self.fetchHandler(files[i], cb);
            }
          })(i)
        );
      }

      async.series(Q, function() {
        var buff;
        for (var i = 0; i < FLen; i++) {
          buff = self.result[files[i]];
          res.write(buff ? buff : new Buffer("/* "+files[i]+" Empty!*/"));
        }
        Log.response(self.HOST+req.url);
        res.end();
      });

    }
    else {
      next();
    }
  }
};

exports = module.exports = FlexCombo;