var DAC = require("dac");
var isUtf8 = DAC.isUtf8;
var iconv = DAC.iconv;

/* 读取文件并返回Unicode编码的字符串，以便在Node.js环境下进行文本处理 */
exports.getUnicode = function (filePath) {
  var fsLib = require("fs");
  if (fsLib.existsSync(filePath)) {
    var buff = fsLib.readFileSync(filePath);
    return isUtf8(buff) ? buff.toString() : iconv.decode(buff, "gbk");
  }
  else {
    return null;
  }
};

exports.getBuffer = function (buff, outputCharset) {
  if (!Buffer.isBuffer(buff)) {
    buff = new Buffer(buff);
  }

  var selfCharset = isUtf8(buff) ? "utf-8" : "gbk";

  if (selfCharset == outputCharset) {
    return buff;
  }
  else {
    return iconv.encode(iconv.decode(buff, selfCharset), outputCharset);
  }
};

/* 是否为二进制文件 */
exports.isBinFile = function (filePath) {
  return !/.js$|.css$|.less$|.scss$|.sass$|.styl$/.test(filePath);
};

exports.MD5 = function (str) {
  var crypto = require("crypto");
  return crypto.createHash("md5").update(str).digest("hex");
};

exports.unique = function (data) {
  var util = require("util");
  if (util.isArray(data)) {
    return data.filter(function (elem, pos) {
      return elem && data.indexOf(elem) == pos;
    });
  }
  else {
    return [];
  }
};
