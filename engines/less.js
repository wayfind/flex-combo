var helper = require("../lib/util");
var less = require("less");

module.exports = function (xcssfile, url, param, cb) {
  xcssfile = xcssfile.replace(/\.css$/, '');
  var lesstext = helper.getUnicode(xcssfile);
  less.render(lesstext, {
    paths: [],
    compress: false,
    filename: xcssfile
  }, function(e, result) {
    cb(e, result.css, xcssfile);
  });
};