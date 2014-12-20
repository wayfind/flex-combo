var helper = require("../lib/util");
var sass = require("node-sass");

exports.compile = function (xcssfile) {
  var sasstxt = helper.getUnicode(xcssfile);
  if (sasstxt) {
    return sass.renderSync({
      data: sasstxt
    }) + "\n";
  }

  return null;
};