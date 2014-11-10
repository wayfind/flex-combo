/**
 * 老版本参数兼容入口（主入口）
 * 通过require("flex-combo")
 * */

var utilLib = require("mace");
var pathLib = require("path");
var FlexCombo = require("./api");

module = module.exports = function(cwd, urls, param) {
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