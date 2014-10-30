var urlLib = require("url");
var mace = require("mace");
var flexCombo = require("./flex-combo");

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

exports = module.exports = function(highParam) {
    if (highParam) {
        param = mace.merge(true, param, highParam);
    }

    return function (req, res, next) {
        if ((urlLib.parse(req.url).pathname).match(/^\/_virtual/)) {
            next();
        }
        else {
            flexCombo(process.cwd(), param.urls, param)(req, res, next);
        }
    }
};

exports.config = function (options) {
    param = mace.merge(true, param, options);
};