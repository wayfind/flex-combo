var helper = require("../lib/util");
var pathLib = require("path");
var less = require("less");
var utilLib = require("mace")(module);

function Loader() {
  this.TREE = {};

  this.vars = [];
  this.func = [];
}
Loader.prototype = {
  constructor: Loader,
  check: function (son, parent) {
    if (this.TREE[parent] && this.TREE[parent] == -1) {
      return true;
    }
    else if (son == parent) {
      return false;
    }
    else {
      return this.check(son, this.TREE[parent]);
    }
  },
  fetch: function (xcssfile, parent) {
    if (parent) {
      this.TREE[xcssfile] = parent;
    }
    else {
      this.TREE[xcssfile] = -1;
    }

    var self = this;
    var lesstxt = helper.getUnicode(xcssfile);

    lesstxt.replace(/^\s{0,}@(.+)\:|^\s{0,}\.(.+)\s{0,}\(.{0,}\)\s{0,}\{[\s\S]*?\}/g, function ($0, $1, $2) {
      if ($1) {
        if (self.vars.indexOf($1) == -1) {
          self.vars.push($1);
        }
        else {
          utilLib.warn("variable %s is defined!", $1);
        }
      }
      if ($2) {
        if (self.func.indexOf($2) == -1) {
          self.func.push($2);
        }
        else {
          utilLib.warn("function %s is defined!", $2);
        }
      }
    });

    lesstxt = lesstxt.replace(/@import\s+(["'])(\S+?)\1;?/mg, function (t, f, relpath) {
      var filepath = pathLib.join(pathLib.dirname(xcssfile), relpath);
      if (!/\.[a-z]{1,}$/i.test(filepath)) {
        filepath += ".less";
      }

      if (self.check(filepath, xcssfile)) {
        return self.fetch(filepath, xcssfile);
      }
      else {
        return "/* Overflow: " + filepath + " */";
      }
    });

    return lesstxt;
  }
};

exports.compile = function (xcssfile) {
  var loader = new Loader();
  var lesstxt = loader.fetch(xcssfile);
  if (lesstxt) {
    return new (less.Parser)({processImports: false})
      .parse(lesstxt, function (e, tree) {
        if (e) {
          return "/* [" + xcssfile + "] LESS COMPILE ERROR! */";
        }
        return tree.toCSS();
      }) + "\n";
  }

  return null;
};