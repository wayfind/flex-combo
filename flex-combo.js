var urlLib  = require("url");
var pathLib = require("path");
var fsLib   = require("fs");
var utilLib = require("mace")(module);
var mime    = require("mime");
var isUtf8  = require("is-utf8");
var iconv   = require("iconv-lite");

var ALProtocol = {
    "http:":  require("http"),
    "https:": require("https")
};

/* 是否为二进制文件 */
function isBinFile(filePath) {
    return !/.js$|.css$|.less$|.scss$|.sass$/.test(filePath);
}

/* 获取应用filter规则后的url */
function filteredUrl(_url) {
    var filter = this.param.filter;
    for (var fk in filter) {
        _url = _url.replace(new RegExp(fk), filter[fk]);
    }
    return _url.replace(/\/{1,}/, '/');
}

/* 读取文件并返回Unicode编码的字符串，以便在Node.js环境下进行文本处理 */
function getUnicode(filePath) {
    if (fsLib.existsSync(filePath)) {
        var buff = fsLib.readFileSync(filePath);
        return isUtf8(buff) ? buff.toString() : iconv.decode(buff, "gbk");
    }
    else {
        return '';
    }
}

/* 以配置文件指定编码输出encoded buffer */
function convert(buff, _url) {
    var charset = isUtf8(buff) ? "utf-8" : "gbk";

    var outputCharset = this.param.charset;
    if (this.param.urlBasedCharset && _url && this.param.urlBasedCharset[_url]) {
        outputCharset = this.param.urlBasedCharset[_url];
    }

    if (charset == outputCharset) {
        return buff;
    }

    return iconv.encode(
        (typeof buff == "string") ? buff : iconv.decode(buff, charset),
        outputCharset
    );
}

/* 获取本地文件绝对路径 */
function getAbsPath(_url) {
    _url = filteredUrl.call(this, _url);

    // urls中key对应的实际目录
    var repPath = '';
    var revPath = _url;
    var map = this.param.urls;
    var longestMatchNum = 0;
    for (k in map) {
        if (_url.indexOf(k) == 0 && longestMatchNum < k.length) {
            longestMatchNum = k.length;

            repPath = map[k];
            revPath = _url.slice(longestMatchNum);
        }
    }

    var absPath = '';
    if (repPath.indexOf('/') == 0 || /^\w{1}:\\.*$/.test(repPath)) {
        absPath = pathLib.normalize(pathLib.join(repPath, revPath));
    }
    else {
        absPath = pathLib.normalize(pathLib.join(process.cwd(), repPath, revPath));
    }

    return absPath;
}

/* 获取文件缓存路径 */
function getCachePath(_url) {
    return pathLib.join(this.cacheDir, utilLib.MD5(_url));
}

/* 从本地读取文件（会尝试进行动态编译） */
function readFromLocal(_url) {
    var absPath = getAbsPath.call(this, _url);
    var buff = null;

    // 尝试使用注册的引擎动态编译
    for (var i=Engines.length-1; i>=0; i--) {
        if (_url.match(new RegExp(Engines[i].rule)) && typeof Engines[i].func == "function") {
            buff = Engines[i].func.call(this, absPath, filteredUrl.call(this, _url));
            break;
        }
    }

    // 尝试读取静态文件
    if (!buff && fsLib.existsSync(absPath)) {
        buff = fsLib.readFileSync(absPath);
    }

    if (buff) {
        if (isBinFile(absPath)) {
            return buff;
        }
        return convert.call(this, buff, _url);
    }

    return null;
}

/* 从缓存读取文件 */
function readFromCache(_url) {
    var absPath = getCachePath.call(this, _url);

    if (fsLib.existsSync(absPath)) {
        var buff = fsLib.readFileSync(absPath);
        if (isBinFile(absPath)) {
            return buff;
        }
        return convert.call(this, buff, _url);
    }

    return null;
}

/* 缓存文件 */
function cacheFile(_url, buff) {
    var absPath = getCachePath.call(this, _url);
    if (/[<>\*\?]+/g.test(absPath)) {
        return;
    }

    fsLib.writeFile(absPath, buff);
}

/* 构建HTTP(s)请求头 */
function buildRequestOption(url, req) {
    var protocol = (req.protocol || "http")+':';

    var H = req.headers.host.split(':');
    var reqHost = H[0];
    var reqPort = H[1] || (protocol=="https" ? 443 : 80);

    var requestOption = {
        protocol: protocol,
        host: this.param.hostIp || reqHost,
        port: reqPort,
        path: url,
        method: req.method || "GET",
        agent: false,
        headers: {host: reqHost}
    };
    requestOption.headers = utilLib.merge(true, this.param.headers, requestOption.headers);

    if (this.param.hosts) {
        for (hostName in this.param.hosts) {
            if (reqHost == hostName) {
                requestOption.host = this.param.hosts[hostName];
                requestOption.headers.host = hostName;
                break;
            }
        }
    }

    if (reqHost == requestOption.host) {
        return false;
    }

    return requestOption;
}

/**
 * URL分析器
 * 可通过.defineParser(func)自定义
 */
var Parser = function(_url) {
    var url = urlLib.parse(_url).path;
    var prefix = url.indexOf(this.param.servlet+'?');

    if (prefix != -1) {
        var base = url.slice(0, prefix);
        var file = url.slice(prefix + this.param.servlet.length+1);
        var filelist = file.split(this.param.seperator, 1000);
        return filelist.map(function(i) {
            return base+i;
        });
    }
    else {
        return [url];
    }
};

/**
 * assets动态编译引擎
 * 可通过.addEngine(rule, func)添加
 */
var Engines = [
    {
        rule: ".less$",
        func: lessCompiler
    },
    {
        rule: ".less.css$",
        func: function(xcssfile) {
            xcssfile = xcssfile.replace(/\.css$/, '');
            return lessCompiler(xcssfile);
        }
    },
    {
        rule: ".scss$",
        func: sassCompiler
    },
    {
        rule: ".scss.css$",
        func: function(xcssfile) {
            xcssfile = xcssfile.replace(/\.css$/, '');
            return sassCompiler(xcssfile);
        }
    },
    {
        rule: "\\.html.js$",
        func: function(htmlfile, filteredUrl) {
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

            htmlfile = htmlfile.replace(/\.js$/, '');
            try {
                var compiled = juicer(getUnicode(htmlfile))._render.toString().replace(/^function anonymous[^{]*?{([\s\S]*?)}$/igm, function ($, fn_body) {
                    return "function(_, _method) {" + method_body + fn_body + "};\n";
                });
            }
            catch (e) {
                return "/* ["+htmlfile+"] Juicer COMPILE ERROR! */";
            }

            var wrapper = this.param.define;
            if (!wrapper || "string" !== typeof wrapper || !!~["window", "global", "self", "parent", "Window", "Global"].indexOf(wrapper)) {
                return "window[\"" + filteredUrl + "\"] = " + compiled;
            }
            else {
                if (this.param.anonymous) {
                    return wrapper + "(function(){return " + compiled + "});";
                }
                else {
                    return wrapper + "(\"" + filteredUrl + "\", function () {return " + compiled + "});";
                }
            }
        }
    }
];

/* LESS动态编译 */
function lessCompiler(xcssfile) {
    var less    = require("less");
    var lesstxt = getUnicode(xcssfile);
    lesstxt = lesstxt.replace(/@import\s+(["'])(\S+?)\1;?/mg, function (t, f, relpath) {
        var filepath = path.join(pathLib.dirname(xcssfile), relpath);
        if (!/\.[a-z]{1,}$/i.test(filepath)) {
            filepath += ".less";
        }

        if (fsLib.existsSync(filepath)) {
            return getUnicode(filepath);
        }
        else {
            return '';
        }
    });

    return new (less.Parser)({processImports: false})
        .parse(lesstxt, function(e, tree) {
            if (e) {
                return "/* ["+xcssfile+"] LESS COMPILE ERROR! */";
            }
            return tree.toCSS();
        }) + "\n";
}

/* SASS动态编译 */
function sassCompiler(xcssfile) {
    var sass = require("node-sass");
    return sass.renderSync({
        data: getUnicode(xcssfile)
    }) + "\n";
}

/**
 * FlexCombo类
 */
function FlexCombo(param, flag) {
    var moduleName = pathLib.basename(__dirname);

    this.param = {
        urls: {},
        hosts: {"a.tbcdn.cn": "115.238.23.240", "g.tbcdn.cn": "115.238.23.250"},
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

    if (flag.indexOf('/') == 0 || /^\w{1}:\\.*$/.test(flag)) {
        this.confFile = pathLib.join(flag, "config.json");
    }
    else {
        this.confFile = pathLib.join(process.cwd(), flag||('.'+moduleName), moduleName+".json");
    }

    var confDir = pathLib.dirname(this.confFile);
    if (!fsLib.existsSync(confDir)) {
        utilLib.mkdirPSync(confDir);
    }

    if (!fsLib.existsSync(this.confFile)) {
        fsLib.writeFileSync(this.confFile, JSON.stringify(this.param, null, 4), {encoding:"utf-8"});
    }

    this.param = utilLib.merge(true, this.param, param||{});

    this.cacheDir = pathLib.join(confDir, "cache");
    if (!fsLib.existsSync(this.cacheDir)) {
        utilLib.mkdirPSync(this.cacheDir);
    }
};
FlexCombo.prototype = {
    constructor: FlexCombo,
    config: function(param) {
        var conf = JSON.parse(fsLib.readFileSync(this.confFile));
        this.param = utilLib.merge(true, this.param, conf, param||{});
    },
    defineParser: function(func) {
        if (typeof func == "function") {
            Parser = func;
        }
    },
    addEngine: function(rule, func) {
        if (rule && typeof func == "function") {
            Engines.push({
                "rule": rule,
                "func": func
            });
        }
    },
    handle: function(req, res, next) {
        this.config();

        var url = urlLib.parse(req.url).path;

        // flex-combo是否要起作用
        if (url.match(new RegExp(this.param.supportedFile))) {
            res.writeHead(200, {
                "Access-Control-Allow-Origin": '*',
                "Content-Type": mime.lookup(url) + ";charset=" + this.param.charset
            });

            // 获取待处理文件列表
            var files = Parser.call(this, req.url.replace(/\\/g, '/'));

            var Q = new Array(files.length);
            var self = this;

            function sendData() {
                var flag = true;
                for (var i=0, len=Q.length; i<len; i++) {
                    flag &= Boolean(Q[i]);
                }

                if (flag) {
                    res.end(utilLib.joinBuffer(Q));
                }
            }

            for (var i=0, len=files.length; i<len; i++) {
                var file = files[i];

                // 读本地最新文件内容
                var localContent = readFromLocal.call(self, file);
                if (localContent) {
                    Q[i] = localContent;
                    continue;
                }

                // 读本地缓存内容
                var cacheContent = readFromCache.call(self, file);
                if (cacheContent) {
                    Q[i] = cacheContent;
                    continue;
                }

                // 读线上内容并缓存
                (function (file, i) {
                    var requestOption = buildRequestOption.call(self, file, req);
                    if (requestOption) {
                        ALProtocol[requestOption.protocol]
                            .request(requestOption, function (nsres) {
                                var buffer = [];
                                nsres
                                    .on("data", function (chunk) {
                                        buffer.push(chunk);
                                    })
                                    .on("end", function () {
                                        var content = utilLib.joinBuffer(buffer);
                                        cacheFile.call(self, file, content);
                                        Q[i] = convert.call(self, content, file);
                                        sendData();
                                    })
                                    .on("error", function () {
                                        Q[i] = convert.call(self, new Buffer("/* "+file+" Proxy ERROR! */"));
                                        sendData();
                                    });
                            })
                            .on("error", function () {
                                Q[i] = convert.call(self, new Buffer("/* "+file+" Req ERROR! */"));
                                sendData();
                            })
                            .end();
                    }
                    else {
                        Q[i] = convert.call(self, new Buffer("/* "+file+" Loop! */"));
                        sendData();
                    }
                })(file, i);
            }
            sendData();
        }
        else {
            next();
        }
    }
};

module = module.exports = FlexCombo;