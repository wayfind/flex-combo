var helper = require("../lib/util");

try {
  var sass = require("node-sass");
  exports.compile = function(xcssfile) {
    var sasstxt = helper.getUnicode(xcssfile);
    if (sasstxt) {
      return sass.renderSync({
        data: sasstxt
      }) + "\n";
    }

    return null;
  };
}
catch(e) {
  exports.compile = function(xcssfile) {
    return "/* node-sass isn't installed\n *"+xcssfile+" ERROR!\n */";
  };
}