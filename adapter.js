var flexCombo = require("./flex-combo");
var readyconf = require("readyconf");
var merge = readyconf.merge;
var pathLib = require("path");

module.exports = function(dir, CMD) {
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

    param = readyconf.init(pathLib.join(process.cwd(), dir, pathLib.basename(__dirname)+".json"), param);

    if (typeof CMD.target != "undefined") {
        param = merge(param, {urls:{'/':CMD.target}});
    }

    return function (next) {
        var comboInst = flexCombo(process.cwd(), param.urls, param);
        comboInst(this.req, this.res, next);
    }
}