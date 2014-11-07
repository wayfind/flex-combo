var utilLib = require("mace");
var pathLib = require("path");

module = module.exports = function(cwd, urls, param) {
    param = utilLib.merge(true, param, {urls:urls});

    var userHome = process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH; // 兼容windows
    var flag = pathLib.join(userHome, ".flex-combo");

    var FlexCombo = require("./api");
    var fcInst = null;

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