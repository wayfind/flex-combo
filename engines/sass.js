var helper = require("../lib/util");

try {
  var sass = require("node-sass");
  module.exports = function(xcssfile) {
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
  module.exports = function(xcssfile) {
    return "/* node-sass isn't installed\n *"+xcssfile+" ERROR!\n */";
  };
}