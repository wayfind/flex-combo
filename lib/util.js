var fsLib  = require("fs");
var isUtf8 = require("is-utf8");
var iconv  = require("iconv-lite");

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
exports.filteredUrl = function(_url, filter) {
    filter = filter || {};
    for (var fk in filter) {
        _url = _url.replace(new RegExp(fk), filter[fk]);
    }
    return _url;
};