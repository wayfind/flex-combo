/**
 * 主入口
 * 通过require("flex-combo")
 * */

var utilLib = require("mace");
var pathLib = require("path");
var FlexCombo = require("./api");

exports = module.exports = function(cwd, urls, param) {
    param = utilLib.merge(true, param, {urls:urls});

    var userHome = process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH; // 兼容windows
    var dir = pathLib.join(userHome, ".flex-combo");

    var fcInst = new FlexCombo(param, dir);

    return function(req, res, next) {
        fcInst = new FlexCombo(param, dir);

        try {
            fcInst.handle(req, res, next);
        }
        catch (e) {
            next();
        }
    };
};

exports.enhanced = function(param, dir) {
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