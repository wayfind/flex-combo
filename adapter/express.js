module = module.exports = function(param, flag) {
    var FlexCombo = require("../flex-combo");
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