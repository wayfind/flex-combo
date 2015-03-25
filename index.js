/**
 * 主入口
 * 通过require("flex-combo")
 * */
var API = require("./api");
var DAC = require("dac");

try {
  var updateNotifier = require("update-notifier");
  var pkg = require(__dirname + "/package.json");
  updateNotifier({pkg: pkg}).notify();
}
catch (e) {
}

var fcInst = new API();
fcInst.addEngine("\\.less$|\\.less\\.css$", DAC.less, "dac/less");
fcInst.addEngine("\\.tpl\\.js$", DAC.tpl, "dac/tpl");
fcInst.addEngine("\\.html\\.js$", function (htmlfile, _url, param, cb) {
  DAC.tpl(htmlfile, _url, param, function (err, result, filepath, MIME) {
    if (typeof result != "undefined") {
      var fs = require("fs");
      fs.writeFile(htmlfile, result, function () {
        fs.chmod(htmlfile, 0777);
      });
    }
    cb(err, result || '', filepath, MIME);
  });
}, "dac/tpl");

exports = module.exports = function (param, dir) {
  return function () {
    fcInst = new API(param, dir);

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

exports.API = API;
exports.engine = function (param, dir) {
  param = param || {};

  var through = require("through2");
  var pathLib = require("path");

  fcInst = new API(param, dir);
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
    fcInst.engineHandler(url, function () {
      var buff = fcInst.result[url];
      if (buff) {
        file.contents = buff;
      }
      self.push(file);
      cb();
    });
  });
};