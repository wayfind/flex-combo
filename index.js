/**
 * 主入口
 * 通过require("flex-combo")
 * */
var fsLib = require("fs");
var pathLib = require("path");
var DAC = require("dac");
var trace = require("plug-trace");
var API = require("./api");

var pkg = require(__dirname + "/package.json");

function init_config(dir, key, except) {
  var mkdirp = require("mkdirp");

  if (dir) {
    var confDir, confFile, json = pkg.name + ".json";
    if (dir.indexOf('/') == 0 || /^\w{1}:[\\/].*$/.test(dir)) {
      if (/\.json$/.test(dir)) {
        confFile = dir;
        confDir = pathLib.dirname(confFile);
      }
      else {
        confDir = dir;
        confFile = pathLib.join(confDir, json);
      }
    }
    else {
      confDir = pathLib.join(process.cwd(), dir);
      confFile = pathLib.join(confDir, json);
    }

    if (!fsLib.existsSync(confDir)) {
      mkdirp.sync(confDir);
      fsLib.chmod(confDir, 0777);
    }

    if (fsLib.existsSync(confFile)) {
      var userParam = require(confFile);
      if (key && typeof userParam[key] == "undefined") {
        var param = require("./lib/param");
        var keys = Object.keys(param[key]);

        userParam[key] = {};
        except = except || [];

        keys.map(function (i) {
          if (except.indexOf(i) == -1 && typeof userParam[i] != "undefined") {
            userParam[key][i] = userParam[i];
            delete userParam[i];
          }
          else {
            userParam[key][i] = param[key][i];
          }
        });

        fsLib.writeFileSync(confFile, JSON.stringify(userParam, null, 2), {encoding: "utf-8"});
        fsLib.chmod(confFile, 0777);
      }
    }

    return confFile;
  }
  else {
    return null;
  }
}

var fcInst = new API();

exports = module.exports = function (param, dir) {
  fcInst.addEngine("\\.less\\.css$|\\.less\\.css\\.map$", DAC.less, "dac/less");
  fcInst.addEngine("\\.less\\.js$", DAC.lessjs, "dac/tpl");
  fcInst.addEngine("\\.less\\.html$", DAC.lesspolymer, "dac/polymer");
  fcInst.addEngine("\\.tpl\\.js$", DAC.tpl, "dac/tpl");
  fcInst.addEngine("\\.cmd\\.js$", DAC.cmd, "dac/tpl");
  fcInst.addEngine("\\.html\\.js$", function (htmlfile, reqOpt, args, cb) {
    DAC.tpl(htmlfile, reqOpt, args, function (err, result, filepath, MIME) {
      if (typeof result != "undefined") {
        fsLib.writeFile(htmlfile, result, function () {
          fsLib.chmod(htmlfile, 0777);
        });
      }
      cb(err, result || '', filepath, MIME);
    });
  }, "dac/tpl");

  var confFile = init_config(dir, "dac/tpl", ["filter"]);

  process.on(pkg.name, function (data) {
    console.log("\n=== Served by %s ===", trace.chalk.white(pkg.name));
    trace(data);
  });

  return function () {
    fcInst = new API(param, confFile);

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
      if (req && res && !res._header && next) {
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
exports.name = pkg.name;
exports.config = require("./lib/param");
exports.engine = function (param, dir) {
  fcInst.addEngine("\\.less$|\\.less\\.css$", DAC.less, "dac/less");
  fcInst.addEngine("\\.less\\.js$", DAC.lessjs, "dac/tpl");
  fcInst.addEngine("\\.less\\.html$", DAC.lesspolymer, "dac/polymer");
  fcInst.addEngine("\\.tpl$|\\.tpl\\.js$", DAC.tpl, "dac/tpl");
  fcInst.addEngine("\\.cmd\\.js$", DAC.cmd, "dac/tpl");

  var through = require("through2");
  var confFile = init_config(dir, "dac/tpl", ["filter"]);

  process
    .removeAllListeners(pkg.name)
    .on(pkg.name, function (data) {
      trace(data, "error");
    });

  return through.obj(function (file, enc, cb) {
    fcInst = new API(param, confFile);

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

    fcInst.stream(file.path, function (buff) {
      if (buff) {
        file.contents = buff;
      }
      self.push(file);
      cb();
    });
  });
};
