/**
 * 主入口
 * 通过require("flex-combo")
 * */
var FlexCombo = require("./api");

module.exports = function (param, dir) {
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