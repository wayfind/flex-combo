var urlLib = require("url");
var pathLib = require("path");
var fsLib = require("fs");
var mime = require("mime");
var isUtf8 = require("is-utf8");
var iconv = require("iconv-lite");
var utilLib = require("mace")(module);
var helper = require("./lib/util");

var ALProtocol = {
  "http:": require("http"),
  "https:": require("https")
};

var Log = (function () {
  function typing(type, url, input) {
    utilLib.logue("%s " + url + " %s %s", '[' + type + ']', "<=", input);
  }

  return {
    request: function (input) {
      utilLib.info("=> %a", input);
    },
    response: function (input) {
      utilLib.done("<= %s\n", input);
    },
    warn: function (input, reason) {
      utilLib.logue("%s " + input + " %s", "[Warn]", reason || "Exception");
    },
    error: function (input) {
      utilLib.error(input);
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
function convert(buff, _url) {
  buff = new Buffer(buff);

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

/* LESS动态编译 */
function lessCompiler(xcssfile) {
  var less = require("./engines/less");
  return less.compile.call(this, xcssfile);
}

/* SASS动态编译 */
function sassCompiler(xcssfile) {
  var sass = require("./engines/sass");
  try {
    return sass.compile.call(this, xcssfile);
  }
  catch (e) {
    return "/* SASS Module ERROR */";
  }
}

/**
 * FlexCombo类
 */
function FlexCombo(param, dir) {
  var moduleName = pathLib.basename(__dirname);

  this.param = require("./lib/param");

  if (dir && (/^\//.test(dir) || /^\w{1}:\\.*$/.test(dir))) {
    this.confFile = pathLib.join(dir, "config.json");
  }
  else {
    this.confFile = pathLib.join(process.cwd(), dir || ('.' + moduleName), moduleName + ".json");
  }

  var confDir = pathLib.dirname(this.confFile);
  if (!fsLib.existsSync(confDir)) {
    utilLib.mkdirPSync(confDir);
  }

  if (!fsLib.existsSync(this.confFile)) {
    fsLib.writeFileSync(this.confFile, JSON.stringify(this.param, null, 2), {encoding: "utf-8"});
  }

  var conf = JSON.parse(fsLib.readFileSync(this.confFile));
  this.param = utilLib.merge(true, this.param, conf, param || {});

  this.cacheDir = pathLib.join(confDir, "cache");
  if (!fsLib.existsSync(this.cacheDir)) {
    utilLib.mkdirPSync(this.cacheDir);
  }
};
FlexCombo.prototype = {
  constructor: FlexCombo,
  config: function (param) {
    this.param = utilLib.merge(true, this.param, param || {});
  },
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
      func: function (xcssfile) {
        return lessCompiler(xcssfile.replace(/\.css$/, ''));
      }
    },
    {
      rule: "\\.scss$",
      func: sassCompiler
    },
    {
      rule: "\\.scss\\.css$",
      func: function (xcssfile) {
        return sassCompiler(xcssfile.replace(/\.css$/, ''));
      }
    },
    {
      rule: "\\.html\\.js$",
      func: function (htmlfile, url) {
        var jstpl = require("./engines/jstpl");
        var content = jstpl.compile.call(this, htmlfile, url);
        if (content) {
          fsLib.writeFile(htmlfile, convert.call(this, content));
        }
        return content;
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
  handle: function (req, res, next) {
    // flex-combo是否要起作用
    var url = urlLib.parse(req.url).path.replace(/\?(\w+)=(.+)$/, '');
    if (url.match(new RegExp(this.param.supportedFile))) {
      res.writeHead(200, {
        "Access-Control-Allow-Origin": '*',
        "Content-Type": mime.lookup(url) + (isBinFile(url) ? '' : ";charset=" + this.param.charset),
        "X-MiddleWare": "flex-combo"
      });

      /* 获取待处理文件列表 */
      var files = this.parser(req.url);
      var Q = new Array(files.length);
      Log.request(files);

      /* 响应输出 */
      function sendData() {
        var flag = true;
        for (var i = 0, len = Q.length; i < len; i++) {
          flag &= Boolean(Q[i]);
        }

        if (flag) {
          res.end(utilLib.joinBuffer(Q));
          Log.response(req.url);
        }
      }

      /* 构建HTTP(s)请求头 */
      function buildRequestOption(url) {
        var protocol = (req.protocol || "http") + ':';

        var H = req.headers.host.split(':');
        var reqHostIP = this.param.hostIp || H[0];
        var reqHostName = H[0];
        var reqPort = H[1] || (protocol == "https:" ? 443 : 80);

        if (this.param.hosts) {
          for (hostName in this.param.hosts) {
            if (reqHostName == hostName) {
              reqHostIP = this.param.hosts[hostName];
              break;
            }
          }
        }

        var requestOption = {
          protocol: protocol,
          host: reqHostIP,
          port: reqPort,
          path: url,
          method: req.method || "GET",
          headers: {host: reqHostName}
        };
        requestOption.headers = utilLib.merge(true, this.param.headers, requestOption.headers);

        if (reqHostIP == reqHostName) {
          return false;
        }
        return requestOption;
      }

      /* 从本地读取文件（会尝试进行动态编译） */
      function readFromLocal(_url) {
        _url = helper.filteredUrl(_url, this.param.filter, this.param.debug);

        // urls中key对应的实际目录
        var repPath = '';
        var revPath = _url;
        var map = this.param.urls;
        var longestMatchNum = 0;
        for (k in map) {
          if (_url.indexOf(k) == 0 && longestMatchNum < k.length) {
            longestMatchNum = k.length;

            repPath = map[k];
            revPath = _url.slice(longestMatchNum);
          }
        }

        var absPath = '';
        if (repPath.indexOf('/') == 0 || /^\w{1}:\\.*$/.test(repPath)) {
          absPath = pathLib.normalize(pathLib.join(repPath, revPath));
        }
        else {
          absPath = pathLib.normalize(pathLib.join(process.cwd(), repPath, revPath));
        }

        // 尝试使用注册的引擎动态编译
        var matchedIndex = -1;
        for (var i = this.engines.length - 1, matched = null, matchedNum = -1; i >= 0; i--) {
          matched = _url.match(new RegExp(this.engines[i].rule));
          if (matched && matched[0].length > matchedNum && typeof this.engines[i].func == "function") {
            matchedNum = matched[0].length;
            matchedIndex = i;
          }
        }

        var buff = null;
        if (matchedIndex >= 0 && this.engines[matchedIndex]) {
          var engine = this.engines[matchedIndex];
          buff = engine.func.call(this, absPath, _url);
          if (buff) {
            var suffix = engine.rule.replace(/^\\./, '').split("\\.");
            this.param.debug && Log.engine(_url, absPath.replace(new RegExp(engine.rule), '.' + (suffix[0] || "unknown")));
          }
          else {
            this.param.debug && Log.warn(absPath, "Engine Fail! TRY TO FIND Local");
          }
        }

        // 尝试读取静态文件
        if (!buff) {
          if (fsLib.existsSync(absPath)) {
            Log.local(_url, absPath);
            buff = fsLib.readFileSync(absPath);
          }
          else {
            this.param.debug && Log.warn(absPath, "Not Found! TRY TO FIND Cache");
          }
        }

        if (buff) {
          if (isBinFile(absPath)) {
            return buff;
          }
          return convert.call(this, buff, _url);
        }

        return null;
      }

      /* 从缓存读取文件 */
      function readFromCache(_url) {
        var absPath = pathLib.join(this.cacheDir, utilLib.MD5(_url));
        if (fsLib.existsSync(absPath)) {
          var buff = fsLib.readFileSync(absPath);
          this.param.debug && Log.cache(_url, absPath);
          if (isBinFile(absPath)) {
            return buff;
          }
          return convert.call(this, buff, _url);
        }
        else {
          this.param.debug && Log.warn(absPath, "Not Found! TRY TO FIND Remote");
        }

        return null;
      }

      /* 缓存文件 */
      function cacheFile(_url, buff) {
        var absPath = pathLib.join(this.cacheDir, utilLib.MD5(_url));
        if (!/[<>\*\?]+/g.test(absPath)) {
          fsLib.writeFile(absPath, buff);
        }
      }

      /* 从线上获取资源 */
      function fetchOnline(file, i) {
        var self = this;
        var requestOption = buildRequestOption.call(self, file);
        if (requestOption) {
          ALProtocol[requestOption.protocol]
            .request(requestOption, function (nsres) {
              var buffer = [];
              nsres
                .on("error", function () {
                  Q[i] = convert.call(self, new Buffer("/* " + file + " Proxy ERROR! */"));
                  Log.error(file);
                  sendData();
                })
                .on("data", function (chunk) {
                  buffer.push(chunk);
                })
                .on("end", function () {
                  var content = utilLib.joinBuffer(buffer);
                  Q[i] = content;
                  cacheFile.call(self, file, content);
                  Log.remote(file, requestOption);
                  sendData();
                });
            })
            .on("error", function () {
              Q[i] = convert.call(self, new Buffer("/* " + file + " Req ERROR! */"));
              Log.error(file);
              sendData();
            })
            .end();
        }
        else {
          Q[i] = convert.call(self, new Buffer("/* " + file + " Loop! */"));
          Log.error(file);
          sendData();
        }
      }

      for (var i = 0, len = files.length; i < len; i++) {
        var file = files[i];

        // 读本地最新文件内容
        var localContent = readFromLocal.call(this, file);
        if (localContent) {
          Q[i] = localContent;
          continue;
        }

        // 读本地缓存内容
        var cacheContent = readFromCache.call(this, file);
        if (cacheContent) {
          Q[i] = cacheContent;
          continue;
        }

        // 读线上内容并缓存
        fetchOnline.call(this, file, i);
      }

      sendData();
    }
    else {
      next();
    }
  }
};

exports = module.exports = FlexCombo;