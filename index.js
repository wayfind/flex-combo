/**
 * 主入口
 * 通过require("flex-combo")
 * */
var FlexCombo = require("./api");
var pathLib = require("path");

function enhanced(param, dir) {
  if (!dir) {
    var userHome = process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH; // 兼容Windows
    dir = pathLib.join(userHome, ".flex-combo");
  }

  var fcInst;

  return function () {
    fcInst = new FlexCombo(param, dir);

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
      next();
    }
  }
};

exports = module.exports = enhanced;
// 以下为了兼容0.6.x版本
exports.enhanced = enhanced;