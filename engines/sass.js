var helper = require("../lib/util");

try {
  var sass = require("node-sass");
  module.exports = function(xcssfile, url, param, cb) {
    xcssfile = xcssfile.replace(/\.css$/, '');
    var sasstxt = helper.getUnicode(xcssfile);
    var result = null
    if (sasstxt) {
      result = sass.renderSync({
        data: sasstxt
      }) + "\n";
    }

    cb(false, result, xcssfile);
  };
}
catch(e) {
  module.exports = function(xcssfile, url, param, cb) {
    cb(false, "/* node-sass isn't installed\n *"+xcssfile+" ERROR!\n */");
  };
}