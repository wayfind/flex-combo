/**
 * 老版本参数兼容入口
 * 通过require("flex-combo/compatibility")，支持原有项目的最小改动升级
 * */

var utilLib = require("mace");
var pathLib = require("path");
var FlexCombo = require("./api");

module = module.exports = function(cwd, urls, param) {
    param = utilLib.merge(true, param, {urls:urls});

    var userHome = process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH; // 兼容windows
    var flag = pathLib.join(userHome, ".flex-combo");

    var fcInst = new FlexCombo(param, flag);

    return function(req, res, next) {
        fcInst = new FlexCombo(param, flag);
        try {
            fcInst.handle(req, res, next);
        }
        catch (e) {
            next();
        }
    }
};