var fsLib = require("fs");
var pathLib = require("path");
var utilLib = require("mace")(module);
var DAC = require("dac");
var isUtf8 = DAC.isUtf8;
var iconv = DAC.iconv;

/* 读取文件并返回Unicode编码的字符串，以便在Node.js环境下进行文本处理 */
exports.getUnicode = function (filePath) {
  if (fsLib.existsSync(filePath)) {
    var buff = fsLib.readFileSync(filePath);
    return isUtf8(buff) ? buff.toString() : iconv.decode(buff, "gbk");
  }
  else {
    return null;
  }
};

/* 获取应用filter规则后的url */
exports.filteredUrl = function (_url, filter, traceRule) {
  filter = filter || {};
  var regx;
  var ori_url;
  for (var fk in filter) {
    regx = new RegExp(fk);
    if (regx.test(_url)) {
      ori_url = _url;
      _url = _url.replace(regx, filter[fk]);
      if (traceRule && traceRule.test("Filter " + ori_url + _url)) {
        utilLib.logue("%s %s " + ori_url + " => %s", "[Filter]", regx, _url);
      }
    }
  }
  return _url;
};

/* 获取应用filter规则后的本地地址 */
exports.getRealPath = function (_url, filter, map) {
  _url = (/^\//.test(_url) ? '' : '/') + _url;
  map = map || {};

  // urls中key对应的实际目录
  var repPath = '';
  var revPath = _url;
  var longestMatchNum = 0;
  for (var k in map) {
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

  return absPath;
};

/* 是否为二进制文件 */
exports.isBinFile = function (filePath) {
  return !/.js$|.css$|.less$|.scss$|.sass$|.styl$/.test(filePath);
};

exports.merge = utilLib.merge;
exports.MD5 = utilLib.MD5;
exports.mkdirPSync = utilLib.mkdirPSync;
exports.joinBuffer = utilLib.joinBuffer;
exports.clone = utilLib.clone;

/* Log */
exports.Log = (function () {
  var colors = {
    bold: [1, 22],
    italic: [3, 23],
    underline: [4, 24],
    inverse: [7, 27],
    white: [37, 39],
    grey: [89, 39],
    black: [30, 39],
    blue: [34, 39],
    cyan: [36, 39],
    green: [32, 39],
    magenta: [35, 39],
    red: [31, 39],
    yellow: [33, 39]
  };

  function colorFull(color, str, style, wrap) {
    var prefix = '\x1B[';

    return [
      wrap ? '·' + new Array(10 - str.length).join(' ') : '',
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