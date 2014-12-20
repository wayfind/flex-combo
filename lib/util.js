var fsLib = require("fs");
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
};