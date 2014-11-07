/**
 * 新版主入口
 * require("flex-combo")，支持Express风格和Koa风格的中间件集成方式
 * */

var FlexCombo = require("./api");

module = module.exports = function(param, flag) {
    var fcInst = new FlexCombo(param, flag);

    return function() {
        fcInst = new FlexCombo(param, flag);

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
                next = function() {
                    console.log("Unknown Web Container!");
                }
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