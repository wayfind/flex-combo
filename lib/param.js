module.exports = {
    urls: {},
    hosts: {
        "a.tbcdn.cn": "115.238.23.240",
        "g.tbcdn.cn": "115.238.23.250",
        "s.tbcdn.cn": "115.238.23.198"
    },
    headers: {},
    servlet: '?',
    seperator: ',',
    charset: "utf-8",
    urlBasedCharset: {},
    supportedFile: "\\.js$|\\.css$|\\.png$|\\.gif$|\\.jpg$|\\.ico$|\\.swf$|\\.xml$|\\.less$|\\.scss$|\\.svg$|\\.ttf$|\\.eot$|\\.woff$|\\.mp3$",
    filter: {
        "\\?.+": '',
        "-min\\.js$": ".js",
        "-min\\.css$": ".css"
    },
    define: "KISSY.add",
    anonymous: false
};