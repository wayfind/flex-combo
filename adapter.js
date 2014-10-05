var pathLib = require("path");
var urlLib = require("url");
var flexCombo = require("./flex-combo");
var readyconf = require("readyconf");
var merge = readyconf.merge;

module.exports = function(confdir, highParam) {
    var param = {
        urls: {'/':"src"},
        hosts: {"a.tbcdn.cn": "122.225.67.241", "g.tbcdn.cn": "115.238.23.250"},
        hostIp:'',
        headers: {},
        servlet: '?',
        seperator: ',',
        charset: "utf-8",
        urlBasedCharset: {},
        supportedFile: "\\.js$|\\.css$|\\.png$|\\.gif$|\\.jpg$|\\.swf$|\\.xml$|\\.less$|\\.scss$|\\.svg$|\\.ttf$|\\.eot$|\\.woff$|\\.mp3$",
        filter: {
            "\\?.+": '',
            "-min\\.js$": ".js",
            "-min\\.css$": ".css"
        },
        define: "KISSY.add",
        anonymous: false
    };

    param = readyconf.init(pathLib.join(process.cwd(), confdir, pathLib.basename(__dirname)+".json"), param);
    if (highParam) {
        param = merge.recursive(param, highParam);
    }

    return function (next) {
        if ((urlLib.parse(this.req.url).pathname).match(/^\/_virtual/)) {
            next();
        }
        else {
            flexCombo(process.cwd(), param.urls, param)(this.req, this.res, next);
        }
    }
}