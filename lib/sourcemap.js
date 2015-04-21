exports = module.exports = function (buffers, files, fileType) {
  var concat = require("source-map-concat");
  var createDummySourceMap = require("source-map-dummy");
  var inlineSourceMapComment = require('inline-source-map-comment');

  var fileURI, fileBuff;
  var FLen = files.length;

  var concatFiles = [];
  for (var i = 0; i < FLen; i++) {
    fileURI = files[i];
    fileBuff = buffers[fileURI] || new Buffer("/* " + fileURI + " Empty!*/");

    concatFiles.push({
      source: fileURI,
      code: fileBuff.toString()
    });
  }
  concatFiles.forEach(function (file) {
    file.map = createDummySourceMap(file.code, {
      source: file.source,
      type: fileType
    });
  });
  var result = concat(concatFiles, {delimiter: "\n"}).toStringWithSourceMap();
  return inlineSourceMapComment(result.map.toString(), {
      block: (fileType == "css" ? true : false)
    });
};
