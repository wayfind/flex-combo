var helper = require("../lib/util");
var less = require("less");

module.exports = function (xcssfile, url, param, cb) {
  xcssfile = xcssfile.replace(/\.css$/, '');

  var lesstext = helper.getUnicode(xcssfile);
  if (lesstext !== null) {
    less.render(lesstext, {
      paths: [],
      compress: false,
      filename: xcssfile
    }, function(e, result) {
      if (!e) {
        cb(e, result.css, xcssfile);
      }
      else {
        console.log(e);
        cb(e, lesstext, xcssfile);
      }
    });
  }
  else {
    cb(true);
  }
};