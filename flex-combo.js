var http = require('http')
    , urlLib = require('url')
    , fs = require('fs')
    , path = require('path')
    , isUtf8 = require('is-utf8')
    , iconv = require('iconv-lite')
    , mkdirp = require('mkdirp')
    , crypto = require('crypto')
    , util = require('util')
    , delog = require("debug.log")
    , mime = require('mime')
    , juicer = require('juicer')
    , sass = require('node-sass')
    , less = require('less')
    , beautify = require('./beautify.js').js_beautify
    , joinbuffers = require('joinbuffers');

var debug = require('debug')('flex-combo:debug');
var debugInfo = require('debug')('flex-combo:info');

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
    "if(typeof(console) !== 'undefined') {",
    "if(console.warn) {",
    "console.warn(error);",
    "return;",
    "}",

    "if(console.log) {",
    "console.log(error);",
    "return;",
    "}",
    "}",

    "throw(error);",
    "};",

    "_method = _method || {};",
    "_method.__escapehtml = __escapehtml;",
    "_method.__throw = __throw;"
].join('');

function cosoleResp(type, c) {
    c += " [" + type + ']';

    switch (type) {
        case "Need":
            delog.request(c);
            break;
        case "Compile":
        case "Embed":
            delog.process(c);
            break;
        case "Disable":
            c = "<= " + c;
        case "Error":
            delog.error(c);
            break;
        case "Local":
        case "Remote":
        case "Cache":
            delog.response(c);
            console.log('');
            break;
        case "Actually":
        default:
            delog.log(c);
    }
}
/**
 Yahoo Combo:
 <script src="http://yui.yahooapis.com/combo
 ?2.5.2/build/editor/editor-beta-min.js
 &2.5.2/build/yahoo-dom-event/yahoo-dom-event.js
 &2.5.2/build/container/container_core-min.js
 &2.5.2/build/menu/menu-min.js
 &2.5.2/build/element/element-beta-min.js
 &2.5.2/build/button/button-min.js">
 </script>

 //淘宝combo server规则a.tbcdn.cn/apps??
 */
var param = {
    prjDir: '',
    urls: {},
    host: "g.tbcdn.cn",
    hosts: {"a.tbcdn.cn": "122.225.67.241", "g.tbcdn.cn": "115.238.23.250"},
    headers: {},
    servlet: '?',
    seperator: ',',
    charset: "utf-8",
    urlBasedCharset: {},
    supportedFile: "\\.js|\\.css|\\.png|\\.gif|\\.jpg|\\.swf|\\.xml|\\.less|\\.scss|\\.svg|\\.ttf|\\.eot|\\.woff|\\.mp3",
    filter: {
        "\\?.+": '',
        "-min\\.js$": ".js",
        "-min\\.css$": ".css"
    },
    define: "KISSY.add",
    anonymous: false,
    fns: []
};

function adaptCharset(buff, outCharset, charset) {
    if (charset === outCharset) {
        return buff;
    }

    return iconv.encode(iconv.decode(buff, charset), outCharset);
}

function filterUrl(url) {
    var filter = param.filter;
    var filtered = url;
    for (var fk in filter) {
        filtered = filtered.replace(new RegExp(fk), filter[fk]);
    }
    if (param.fns) {
        param.fns.forEach(function (fn) {
            try {
                filtered = fn(filtered);
            }
            catch (e) {

            }
        });
    }
    cosoleResp('Path', filtered);
    return filtered;
}

function isBinFile(fileName) {
    fileName = fileName.split('?')[0];
    return !/.js$|.css$|.less$|.scss$/.test(fileName);
}

/*
 * 根据传入的返回最长匹配的目录映射
 */
function longgestMatchedDir(fullPath) {
    fullPath = fullPath.split('?')[0];
    var map = param.urls;
    var longestMatchNum = -1 , longestMatchPos = null;
    for (k in map) {
        if (fullPath.replace(/\\/g, '/').indexOf(k) === 0 && longestMatchNum < k.length) {
            longestMatchNum = k.length;
            longestMatchPos = k;
        }
    }
    return longestMatchPos;
}

/*
 * 根据一个文件的全路径(如：/xxx/yyy/aa.js)从本地文件系统获取内容
 */
function readFromLocal(fullPath) {
    fullPath = fullPath.split('?')[0];
    var longestMatchPos = longgestMatchedDir(fullPath);
    if (!longestMatchPos) return null;

    //找到最长匹配的配置，顺序遍历已定义好的目录。多个目录用逗号","分隔。
    var map = param.urls;
    var dirs = map[longestMatchPos].split(',');
    for (var i = 0, len = dirs.length; i < len; i++) {
        var dir = dirs[i];
        var revPath = path.join(fullPath.slice(longestMatchPos.length, fullPath.length));
        debug('The rev path is %s', revPath);

        var absPath = '';
        // 如果是绝对路径，直接使用
        if (dir.indexOf('/') === 0 || /^\w{1}:\\.*$/.test(dir)) {
            absPath = path.normalize(path.join(dir, revPath));
        }
        else {
            absPath = path.normalize(path.join(param.prjDir, dir, revPath));
        }

        // 前后端模板一致化，如果是*.html.js格式的请求，则编译*.html为juicer的function格式返回
        if (/\.html\.js$/i.test(absPath)) {
            var htmlName = absPath.replace(/\.js$/, '');
            var buff = fs.readFileSync(htmlName);
            var charset = isUtf8(buff) ? 'utf8' : 'gbk';
            var tpl = iconv.decode(buff, charset);
            try {
                var compiled = juicer(tpl)._render.toString().replace(/^function anonymous[^{]*?{([\s\S]*?)}$/igm, function ($, fn_body) {
                    return 'function(_, _method) {' + method_body + fn_body + '};\n';
                });
            }
            catch (e) {
                cosoleResp('Error', 'Compile failed with error ' + e.message);
                return '';
            }

            var tempalteFunction;
            param.define = param.define || '';
            // 未声明需要哪个定义模块
            // 或者声明的错误
            // 或者声明的是 `window`
            if (
                !param.define ||
                    'string' !== typeof param.define || !!~['window', 'global', 'self', 'parent', 'Window', 'Global'].indexOf(param.define)
                ) {
                debug('The package define is undefined or not a string');
                tempalteFunction = 'window["' + revPath + '"] = ' + compiled;
            }
            else {
                if (param.anonymous) {
                    debug('Define a anonymous module');
                    tempalteFunction = param.define + '(function(){return ' + compiled + '});';
                }
                else {
                    debug('Define a module with id');
                    tempalteFunction = param.define + '("' + revPath + '", function () {return ' + compiled + '});';
                }
            }

            cosoleResp('Compile', htmlName);
            cosoleResp('Local', absPath);

            fs.writeFile(absPath, tempalteFunction);

            // 允许为某个url特别指定编码
            var outputCharset = param.charset;
            if (param.urlBasedCharset && param.urlBasedCharset[longestMatchPos]) {
                outputCharset = param.urlBasedCharset[longestMatchPos];
            }
            return iconv.encode(tempalteFunction, outputCharset);
        }

        // 处理css, Added by jayli, Enhanced by liming.mlm
        if (/\.css$/i.test(absPath)) {
            function lessCompiler(xcssfile, absPath) {
                var buff = fs.readFileSync(xcssfile);
                var charset = isUtf8(buff) ? 'utf8' : 'gbk';
                var lesstxt = iconv.decode(buff, charset);

                lesstxt = lesstxt.replace(/\@import\s+["'](.+)["']\;/g, function (t, basename) {
                    var filepath = path.join(path.dirname(xcssfile), basename);
                    if (!/\.[a-z]{1,}$/i.test(filepath)) {
                        filepath += ".less";
                    }

                    if (fs.existsSync(filepath)) {
                        cosoleResp("Embed", filepath);
                        return fs.readFileSync(filepath);
                    }
                    else {
                        return '';
                    }
                });

                cosoleResp("Compile", xcssfile);

                var content = new (less.Parser)({processImports: false})
                    .parse(lesstxt, function (e, tree) {
                        cosoleResp("Local", absPath ? absPath : xcssfile);
                        return tree.toCSS();
                    });

                if (absPath) fs.writeFile(absPath, content);

                return content + "\n";
            }

            function scssCompiler(xcssfile, absPath) {
                cosoleResp("Compiling", xcssfile);

                var content = sass.renderSync({
                    file: xcssfile,
                    success: function (css, map) {
                        cosoleResp("Local", absPath ? absPath : xcssfile);
                    }
                });

                if (absPath) fs.writeFile(absPath, content);

                return content + "\n";
            }

            var xcssfile = absPath.replace(/\.css$/i, '');

            // less文件解析 less.css => .less
            if (/\.less\.css$/i.test(absPath) && fs.existsSync(xcssfile)) {
                return lessCompiler(xcssfile, absPath);
            }

            // scss文件解析 scss.css => scss
            if (/\.scss\.css$/i.test(absPath) && fs.existsSync(xcssfile)) {
                return scssCompiler(xcssfile, absPath);
            }

            // .css => .less
            xcssfile = absPath.replace(/\.css$/i, '.less');
            if (!fs.existsSync(absPath) && fs.existsSync(xcssfile)) {
                return lessCompiler(xcssfile);
            }
            // .css => .scss
            xcssfile = absPath.replace(/\.css$/i, '.scss');
            if (!fs.existsSync(absPath) && fs.existsSync(xcssfile)) {
                return scssCompiler(xcssfile);
            }
        }

        if (fs.existsSync(absPath)) {
            cosoleResp('Local', absPath);

            var buff = fs.readFileSync(absPath);
            if (isBinFile(absPath)) {
                return buff;
            }

            // 允许为某个url特别指定编码
            var charset = isUtf8(buff) ? 'utf8' : 'gbk';
            var outputCharset = param.charset;
            if (param.urlBasedCharset && param.urlBasedCharset[longestMatchPos]) {
                outputCharset = param.urlBasedCharset[longestMatchPos];
            }
            return adaptCharset(buff, outputCharset, charset);
        }

    }
    return null;
}

var merge = function (dest, src) {
    for (var i in src) {
        if (src[i] === Object(src[i])) {
            if (!dest[i]) {
                dest[i] = {};
            }
            merge(dest[i], src[i]);
            continue;
        }
        dest[i] = src[i];
    }
    return dest;
}

var cacheFileName = function (url) {
    return crypto.createHash('md5').update(url).digest('hex');
}

var cacheFile = function (fullPath, content) {
    var absPath = path.join(param.cacheDir, fullPath);
    var lastDir = path.dirname(absPath);
    if (/[<>\*\?]+/g.test(absPath)) {
        debugInfo('Exception file name: can not cache to %s', absPath);
        return;
    }
    if (!fs.existsSync(lastDir)) {
        debug('%s is not exist', lastDir);
        mkdirp.sync(lastDir, {mode: 0777});
    }

    debug('保存缓存%s', fullPath);
    fs.writeFile(absPath, content);
}

var readFromCache = function (url, fullPath) {
    var absPath = path.join(param.cacheDir, fullPath);
    if (fs.existsSync(absPath)) {
        cosoleResp('Cache', absPath);

        var buff = fs.readFileSync(absPath);
        if (isBinFile(absPath)) {
            return buff;
        }

        // 允许为某个url特别指定编码
        var charset = isUtf8(buff) ? 'utf8' : 'gbk';
        var outputCharset = param.charset;
        var longestMatchPos = longgestMatchedDir(url);
        if (longestMatchPos) {
            if (param.urlBasedCharset && param.urlBasedCharset[longestMatchPos]) {
                outputCharset = param.urlBasedCharset[longestMatchPos];
            }
        }
        return adaptCharset(buff, outputCharset, charset);
    }
    return null;
}

function buildRequestOption(url, req) {
    var requestOption = {
        host: param.hostIp || param.host,
        port: 80,
        path: url,
        headers: {host: param.host}
    };

    requestOption.headers = merge(requestOption.headers, param.headers);
    requestOption.agent = false;

    if (param.hosts) {
        var reqHost = req.headers.host.split(':')[0];
        for (hostName in param.hosts) {
            if (reqHost == hostName) {
                requestOption.host = param.hosts[hostName];
                requestOption.headers.host = hostName;
                break;
            }
        }
    }
    return requestOption;
}

function isLoop(reqHost, requestOption) {
    //远程请求的域名不能和访问域名一致，否则会陷入请求循环。
    if (reqHost === requestOption.host) {
        cosoleResp('Error', reqHost + " is will lead to Loop Req!");
        return true;
    }
    else {
        return false;
    }
}

exports = module.exports = function (prjDir, urls, options) {
    var userHome = process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH;//兼容windows

    var cacheDir = path.join(userHome, '.flex-combo/cache');
    if (!fs.existsSync(cacheDir)) {
        mkdirp.sync(cacheDir, {mode: 0777});
    }

    var userConfigPath = path.join(userHome, '.flex-combo/config.json');
    if (!fs.existsSync(userConfigPath)) {
        if (!fs.existsSync(path.dirname(userConfigPath))) {
            mkdirp.sync(path.dirname(userConfigPath), {mode: 0777});
        }
        fs.writeFile(userConfigPath, beautify(JSON.stringify(param)));
    }
    else {
        var paramStr = fs.readFileSync(userConfigPath);
        paramStr.toString().replace(/[\n\r]/g, '');
        param = merge(param, JSON.parse(paramStr));
    }

    param.cacheDir = cacheDir;
    if (urls) {
        param.urls = merge(param.urls, urls);
    }
    if (options) {
        options.urls = param.urls;
        param = merge(param, options);
    }
    param.prjDir = prjDir;
    debug(util.inspect(param));

    var fileReg = new RegExp(param.supportedFile);
    return function (req, res, next) {
        function nextAction() {
            try {
                next();
            }
            catch (e) {
                res.writeHead(500, {'Content-Type': 'text/html'});
                res.end("<h1>Error 500</h1>");
            }
        }

        var reqHost = req.headers.host.split(':')[0];
        var url = urlLib.parse(req.url).path;
        var prefix = url.indexOf(param.servlet + '?');

        //不包含combo的servlet，认为是单一文件
        if (prefix === -1) {
            //combo不处理html文件，但是需要接管其他资源
            if (!fileReg.test(url)) {
                nextAction();
                return;
            }
            cosoleResp('Need', url);

            var filteredUrl = filterUrl(url);
            res.writeHead(200, {
                "Access-Control-Allow-Origin": '*',
                "Content-Type": mime.lookup(filteredUrl.split('?')[0]) + ';charset=' + param.charset
            });

            var singleFileContent = readFromLocal(filteredUrl);
            if (singleFileContent) {
                res.end(singleFileContent);
                return;
            }

            var cachedFile = readFromCache(filteredUrl, cacheFileName(path.join(reqHost, url)));
            if (cachedFile) {
                res.end(cachedFile);
                return;
            }

            //本地没有，从服务器获取
            var requestOption = buildRequestOption(url, req);

            if (isLoop(reqHost, requestOption)) {
                nextAction();
                return;
            }

            http.get(requestOption, function (resp) {
                var buffs = [];
                if (resp.statusCode !== 200) {
                    cosoleResp("Disable", requestOption.headers.host + requestOption.path + " (HOST: " + requestOption.host + ')');

                    nextAction();
                    return;
                }
                resp.on('data', function (chunk) {
                    buffs.push(chunk);
                });
                resp.on('end', function () {
                    var buff = joinbuffers(buffs);

                    //fix 80% situation bom problem.quick and dirty
                    if (buff[0] === 239 && buff[1] === 187 && buff[2] === 191) {
                        buff = buff.slice(3, buff.length);
                    }

                    cosoleResp('Remote', requestOption.headers.host + requestOption.path + " (HOST: " + requestOption.host + ')');

                    if (isBinFile(filteredUrl)) {
                        cacheFile(cacheFileName(path.join(reqHost, requestOption.path)), buff);
                        res.end(buff);
                        return;
                    }

                    cacheFile(cacheFileName(path.join(reqHost, url)), buff);

                    // 允许为某个url特别指定编码
                    var charset = isUtf8(buff) ? 'utf8' : 'gbk';
                    var longestMatchPos = longgestMatchedDir(filteredUrl);
                    var outputCharset = param.charset;
                    if (longestMatchPos) {
                        if (param.urlBasedCharset && param.urlBasedCharset[longestMatchPos]) {
                            outputCharset = param.urlBasedCharset[longestMatchPos];
                        }
                    }
                    var singleFileContent = adaptCharset(buff, outputCharset, charset);
                    res.end(singleFileContent);
                    return;
                });
            })
                .on('error', function (e) {
                    debugInfo('Networking error:' + e.message);
                    res.writeHead(404, {'Content-Type': 'text/html;charset=utf-8'});
                    res.end('404 Error, File not found.');
                    return;
                });
            return;
        }

        cosoleResp('Need', url);
        prefix = url.substring(0, prefix);
        var files = url.substring(prefix.length + param.servlet.length + 1, url.length);
        files = files.split(param.seperator, 1000);

        var reqArray = [];
        var prevNeedHttp = false;   //为循环做准备，用来判定上次循环的file是否需要通过http获取
        var needHttpGet = '';
        for (var i = 0, len = files.length; i < len; i++) {
            var file = files[i];

            //combo URL有时候会多一个逗号
            if (file === '') continue;
            var fullPath = filterUrl(prefix + files[i]);
            if (i === 0) {
                res.setHeader('Content-Type', mime.lookup(fullPath.split('?')[0]) + ';charset=' + param.charset);
            }

            var fileContent = readFromLocal(fullPath);
            if (!fileContent) {
                if (prevNeedHttp) {
                    needHttpGet += ',' + file;
                    continue;
                }
                prevNeedHttp = true;
                needHttpGet = file;
                continue;
            }
            if (prevNeedHttp) {
                reqArray.push({file: needHttpGet, ready: false});
            }
            prevNeedHttp = false;
            reqArray.push({file: file, content: fileContent, ready: true});
        }

        if (prevNeedHttp) {
            reqArray.push({file: needHttpGet, ready: false});
        }

        var reqPath = prefix + param.servlet + '?';
        for (var i = 0, len = reqArray.length; i < len; i++) {
            if (reqArray[i].ready) {
                continue;
            }

            var cachedContent = readFromCache(reqArray[i].file, cacheFileName(path.join(reqHost, reqArray[i].file)));
            if (cachedContent) {
                reqArray[i].content = cachedContent;
                reqArray[i].ready = true;
                continue;
            }

            (function (id) {
                var requestPath = reqPath + reqArray[id].file;
                var requestOption = buildRequestOption(requestPath, req);

                if (isLoop(reqHost, requestOption)) {
                    reqArray[id].ready = true;
                    reqArray[id].content = 'Request ' + reqHost + ' is Forbidden.';
                }
                else {
                    http.get(requestOption, function (resp) {
                        if (resp.statusCode !== 200) {
                            cosoleResp("Disable", requestOption.headers.host + reqPath + reqArray[id].file + " (HOST: " + requestOption.host + ')');
                            reqArray[id].ready = true;
                            reqArray[id].content = 'File ' + reqArray[id].file + ' not found.';
                            sendData();
                            return;
                        }

                        var buffs = [];
                        resp.on('data', function (chunk) {
                            buffs.push(chunk);
                        });
                        resp.on('end', function () {
                            cosoleResp('Remote', requestOption.headers.host + reqPath + reqArray[id].file + " (HOST: " + requestOption.host + ')');
                            reqArray[id].ready = true;
                            var buff = joinbuffers(buffs);

                            //fix 80% situation bom problem.quick and dirty
                            if (buff[0] === 239 && buff[1] === 187 && buff[2] === 191) {
                                buff = buff.slice(3, buff.length);
                            }

                            var charset = isUtf8(buff) ? 'utf8' : 'gbk';
                            reqArray[id].content = adaptCharset(buff, param.charset, charset);
                            cacheFile(cacheFileName(path.join(reqHost, reqArray[id].file)), buff);
                            sendData();
                        });
                    })
                        .on('error', function (e) {
                            reqArray[id].ready = true;
                            debug('Networking error:' + e.message);
                        });
                }
            })(i);
        }

        var sendData = function () {
            for (var j = 0, len = reqArray.length; j < len; j++) {
                if (reqArray[j].ready === false) {
                    return;
                }
            }
            reqArray.forEach(function (reqNode) {
                res.write(reqNode.content);
            });
            res.end();
        }

        //如果全部都在本地可以获取到，就立即返回内容给客户端
        sendData();
    }
}
