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

module.exports = function (htmlfile, _url, param, cb) {
  htmlfile = htmlfile.replace(/\.html\.js$|\.jpl$|\.jpl\.js$/, ".html");

  var tpl = helper.getUnicode(htmlfile);
  var result = null;
  if (tpl) {
    try {
      var compiled = juicer(tpl)._render.toString().replace(/^function anonymous[^{]*?{([\s\S]*?)}$/igm, function ($, fn_body) {
        return "function(_, _method) {" + method_body + fn_body + "};\n";
      });
    }
    catch (e) {
      result = null;
    }

    var wrapper = param.define;
    var packageName = helper.filteredUrl(_url, param.filter);
    if (!wrapper || "string" !== typeof wrapper || !!~["window", "global", "self", "parent", "Window", "Global"].indexOf(wrapper)) {
      result = "window[\"" + packageName + "\"] = " + compiled;
    }
    else {
      if (param.anonymous) {
        result = wrapper + "(function(){return " + compiled + "});";
      }
      else {
        result = wrapper + "(\"" + packageName + "\", function () {return " + compiled + "});";
      }
    }
  }

  cb(false, result, htmlfile);
};
