/**
 * 支持Express风格和Koa风格的中间件集成方式入口
 * require("flex-combo/enhanced")
 * */

var FlexCombo = require("./api");

module = module.exports = function(param, dir) {
    var fcInst = new FlexCombo(param, dir);

    return function() {
        fcInst = new FlexCombo(param, dir);

        var req, res, next;
        switch (arguments.length) {
            case 1:
                req  = this.req;
                res  = this.res;
                next = arguments[0];
                break;
            case 3:
                req  = arguments[0];
                res  = arguments[1];
                next = arguments[2];
                break;
            default:
                next = function() {
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