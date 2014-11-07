var helper  = require("../lib/util");
var pathLib = require("path");
var less    = require("less");

exports.compile = function(xcssfile) {
    var lesstxt = helper.getUnicode(xcssfile);
    if (lesstxt) {
        lesstxt = lesstxt.replace(/@import\s+(["'])(\S+?)\1;?/mg, function(t, f, relpath) {
            var filepath = path.join(pathLib.dirname(xcssfile), relpath);
            if (!/\.[a-z]{1,}$/i.test(filepath)) {
                filepath += ".less";
            }
            return helper.getUnicode(filepath);
        });

        return new (less.Parser)({processImports: false})
            .parse(lesstxt, function(e, tree) {
                if (e) {
                    return "/* ["+xcssfile+"] LESS COMPILE ERROR! */";
                }
                return tree.toCSS();
            }) + "\n";
    }

    return null;
};