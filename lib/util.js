var fsLib = require("fs");
var pathLib = require("path");
var isUtf8 = require("is-utf8");
var iconv = require("iconv-lite");
var utilLib = require("mace")(module);

/* 读取文件并返回Unicode编码的字符串，以便在Node.js环境下进行文本处理 */
exports.getUnicode = function (filePath) {
  if (fsLib.existsSync(filePath)) {
    var buff = fsLib.readFileSync(filePath);
    return isUtf8(buff) ? buff.toString() : iconv.decode(buff, "gbk");
  }
  else {
    return '';
  }
};

/* 获取应用filter规则后的url */
exports.filteredUrl = function (_url, filter, debug) {
  filter = filter || {};
  var regx;
  for (var fk in filter) {
    regx = new RegExp(fk);
    if (_url.match(regx)) {
      _url = _url.replace(regx, filter[fk]);
      debug && utilLib.logue("%s %s Applied: %s", "[Filter]", regx, _url);
    }
  }
  return _url;
}

/* 获取应用filter规则后的本地地址 */
exports.getRealPath = function (_url, filter, map, debug) {
  _url = exports.filteredUrl(_url, filter, debug);
  _url = (_url.match(/^\//) ? '' : '/') + _url;
  map  = map || {};

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