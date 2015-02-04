/**
 * 主入口
 * 通过require("flex-combo")
 * */
var FlexCombo = require("./api");
var DAC = require("dac");
FlexCombo.prototype.addEngine("\\.less$|\\.less\\.css$", DAC.less);
FlexCombo.prototype.addEngine("\\.jpl$", DAC.jpl);
FlexCombo.prototype.addEngine("\\.html.js", function(htmlfile, _url, param, cb) {
  DAC.jpl(htmlfile, _url, param, function(err, result, filepath) {
    var fs = require("fs");
    fs.writeFile(htmlfile, result, function() {
      fs.chmod(htmlfile, 0777);
    });
    cb(err, result, filepath);
  });
});

exports = module.exports = function (param, dir) {
  return function () {
    var fcInst = new FlexCombo(param, dir);

    var req, res, next;
    switch (arguments.length) {
      case 1:
        req = this.req;
        res = this.res;
        next = arguments[0];
        break;
      case 3:
        req = arguments[0];
        res = arguments[1];
        next = arguments[2];
        break;
      default:
        next = function () {
          console.log("Unknown Web Container!");
        };
    }

    try {
      if (req && res && next) {
        fcInst.handle(req, res, next);
      }
      else {
        next();
      }
    }
    catch (e) {
      console.log(e);
    }
  }
};

exports.engine = function(param, dir) {
  param = param || {};

  var through = require("through2");
  var pathLib = require("path");
  var fcInst = new FlexCombo(param, dir);
  fcInst.param.traceRule = false;

  return through.obj(function (file, enc, cb) {
    var self = this;

    if (file.isNull()) {
      self.emit("error", "isNull");
      cb(null, file);
      return;
    }

    if (file.isStream()) {
      self.emit("error", "Streaming not supported");
      cb(null, file);
      return;
    }

    var url = file.path.replace(pathLib.join(process.cwd(), fcInst.param.rootdir), '');
    fcInst.engineHandler(url, url, function() {
      var buff = fcInst.result[url];
      if (buff) {
        file.contents = buff;
      }
      self.push(file);
      cb();
    });
  });
};