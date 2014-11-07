var helper = require("../lib/util");
var juicer = require("juicer");

var method_body = [
    "var __escapehtml = {",
    "escapehash: {",
    "'<': '&lt;',",
    "'>': '&gt;',",
    "'&': '&amp;',",
    "'\"': '&quot;',",
    "\"'\": '&#x27;',",
    "'/': '&#x2f;'",
    "},",
    "escapereplace: function(k) {",
    "return __escapehtml.escapehash[k];",
    "},",
    "escaping: function(str) {",
    "return typeof(str) !== 'string' ? str : str.replace(/[&<>\"]/igm, this.escapereplace);",
    "},",
    "detection: function(data) {",
    "return typeof(data) === 'undefined' ? '' : data;",
    "}",
    "};",

    "var __throw = function(error) {",
    "throw(error);",
    "};",

    "_method = _method || {};",
    "_method.__escapehtml = __escapehtml;",
    "_method.__throw = __throw;"
].join('');

exports.compile = function(htmlfile, _url) {
    htmlfile = htmlfile.replace(/\.js$/, '');

    try {
        var compiled = juicer(helper.getUnicode(htmlfile))._render.toString("utf-8").replace(/^function anonymous[^{]*?{([\s\S]*?)}$/igm, function ($, fn_body) {
            return "function(_, _method) {" + method_body + fn_body + "};\n";
        });
    }
    catch (e) {
        return "/* ["+htmlfile+"] Juicer COMPILE ERROR! */";
    }

    var wrapper = this.param.define;
    var packageName = helper.filteredUrl(_url, this.param.filter);
    var jstpl = '';
    if (!wrapper || "string" !== typeof wrapper || !!~["window", "global", "self", "parent", "Window", "Global"].indexOf(wrapper)) {
        jstpl = "window[\"" + packageName + "\"] = " + compiled;
    }
    else {
        if (this.param.anonymous) {
            jstpl = wrapper + "(function(){return " + compiled + "});";
        }
        else {
            jstpl = wrapper + "(\"" + packageName + "\", function () {return " + compiled + "});";
        }
    }

    return jstpl;
};
