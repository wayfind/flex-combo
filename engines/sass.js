var helper = require("../lib/util");

try {
  var sass = require("node-sass");
  module.exports = function(xcssfile, url, param, cb) {
    xcssfile = xcssfile.replace(/\.css$/, '');
    var sasstext = helper.getUnicode(xcssfile);

    if (sasstext !== null) {
      sass.render({
        file: xcssfile,
        success: function(result) {
          cb(false, result.css, xcssfile);
        },
        error: function(error) {
          console.log(error);
          cb(false, sasstext, xcssfile);
        }
      });
    }
    else {
      cb(true);
    }
  };
}
catch(e) {
  module.exports = function(xcssfile, url, param, cb) {
    cb(false, "/* node-sass isn't installed\n *"+xcssfile+" ERROR!\n */");
  };
}