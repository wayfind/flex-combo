module = module.exports = function(param, flag) {
    var FlexCombo = require("../flex-combo");
    var fcInst = new FlexCombo(param, flag);

    /*
    fcInst.defineParser(function(url) {
        return [];
    });
    fcInst.addEngine("\\.suffix$", function(absPath, url) {
        return "";
    });
    */

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