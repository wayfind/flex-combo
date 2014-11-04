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

var http = require('http')
    , urlLib = require('url')
    , fs = require('fs')
    , path = require('path')
    , isUtf8 = require('is-utf8')
    , iconv = require('iconv-lite')
    , mace = require('mace')
    , crypto = require('crypto')
    , util = require('util')
    , mime = require('mime')
    , debug = require('debug')('flex-combo:debug')
    , debugInfo = require('debug')('flex-combo:info')
    , delog = require("debug.log")
    , dac = require('dac');

var param = {
    urls: {},
    hosts: {"a.tbcdn.cn": "122.225.67.241", "g.tbcdn.cn": "115.238.23.250"},
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

var userHome = process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH; // 兼容windows
var commonDir = path.join(userHome, '.'+path.basename(__dirname));
var cacheDir = path.join(commonDir, "cache");
if (!fs.existsSync(cacheDir)) {
    mace.mkdirPSync(cacheDir, {mode: 0777});
}

(function (confFile, param) {
    var confDir = path.dirname(confFile);
    if (!fs.existsSync(confDir)) {
        mace.mkdirPSync(confDir, {mode: 0777});
    }

    if (!fs.existsSync(confFile)) {
        fs.writeFileSync(confFile, JSON.stringify(param, null, 4), {encoding:"utf-8"});
    }
    else {
        param = mace.merge(true, param, JSON.parse(fs.readFileSync(confFile, {encoding:"utf-8"})));
    }

    return param;
})(path.join(commonDir, "config.json"), param);

param.cacheDir = cacheDir;
param.prjDir = process.cwd();

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

function adaptCharset(buff, outCharset, charset) {
    if (charset === outCharset) {
        return buff;
    }

    return iconv.encode(iconv.decode(buff, charset)+"\n", outCharset);
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

        // html.js
        var jstpl = dac.jstpl(absPath, param.charset, revPath, param.define, param.anonymous);
        if (jstpl) {
            fs.writeFile(absPath, jstpl);
            return jstpl;
        }

        // compile less.css OR scss.css
        var css = dac.css(absPath, param.charset);
        if (css) {
            return css;
        }

        if (fs.existsSync(absPath)) {
            cosoleResp('Local', absPath);

            var buff = fs.readFileSync(absPath);
            if (isBinFile(absPath)) {
                return buff;
            }

            // 允许为某个url特别指定编码
            var charset = isUtf8(buff) ? 'utf-8' : 'gbk';
            var outputCharset = param.charset;
            if (param.urlBasedCharset && param.urlBasedCharset[longestMatchPos]) {
                outputCharset = param.urlBasedCharset[longestMatchPos];
            }
            return adaptCharset(buff, outputCharset, charset);
        }

    }
    return null;
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
        mace.mkdirPSync(lastDir, {mode: 0777});
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
        var charset = isUtf8(buff) ? 'utf-8' : 'gbk';
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
        host: param.hostIp || req.headers.host,
        port: 80,
        path: url,
        headers: {host: req.headers.host}
    };

    requestOption.headers = mace.merge(true, requestOption.headers, param.headers);
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
    if (prjDir) {
        param.prjDir = prjDir;
    }
    if (urls) {
        param.urls = mace.merge(true, param.urls, urls);
    }
    if (options) {
        param = mace.merge(true, param, options);
    }
    if (param.charset) {
        param.charset = param.charset.replace(/utf(\d+)/, "utf-$1");
    }
    debug(util.inspect(param));

    return function (req, res, next) {
        function nextAction() {
            try {
                next();
            }
            catch (e) {
                res.writeHead(500, {"Content-Type": "text/html"});
                res.end("<h1>Error 500</h1>");
            }
        }

        var reqHost = req.headers.host.split(':')[0];
        var url = urlLib.parse(req.url).path;
        var prefix = url.indexOf(param.servlet + '?');

        //不包含combo的servlet，认为是单一文件
        if (prefix === -1) {
            //combo不处理html文件，但是需要接管其他资源
            if (!new RegExp(param.supportedFile).test(url)) {
                nextAction();
                return;
            }

            cosoleResp("Need", url);

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

			if( requestOption.host.indexOf(':') > 0 ) {
				var _port = requestOption.host.match(/\d+$/)[0];
				requestOption.host = requestOption.host.replace(/:\d+$/,'');
				requestOption.port = _port;
			}
            http
                .get(requestOption, function (resp) {
                    var buffs = [];
                    if (resp.statusCode !== 200) {
                        cosoleResp("Disable", requestOption.headers.host + requestOption.path + " (HOST: " + requestOption.host + ')');

                        nextAction();
                        return;
                    }
                    resp
                        .on('data', function (chunk) {
                            buffs.push(chunk);
                        })
                        .on('end', function () {
                            var buff = mace.joinBuffer(buffs);

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
                            var charset = isUtf8(buff) ? 'utf-8' : 'gbk';
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

        prefix = url.substring(0, prefix);
        var files = url.substring(prefix.length + param.servlet.length + 1, url.length);
        files = files.split(param.seperator, 1000);

        if (!files.length) {
            nextAction();
            return;
        }

        cosoleResp("Need", url);

        var reqArray = [];
        var prevNeedHttp = false;   //为循环做准备，用来判定上次循环的file是否需要通过http获取
        var needHttpGet = '';
        for (var i = 0, len = files.length; i < len; i++) {
            var file = files[i];
            //combo URL有时候会多一个逗号
            if (file === '') continue;

            var fullPath = filterUrl(prefix + file);
            if (i === 0) {
                res.writeHead(200, {
                    "Content-Type": mime.lookup(fullPath.split('?')[0]) + ";charset=" + param.charset
                });
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
                    reqArray[id].content = '/* Request ' + reqHost + ' is Forbidden. */';
                }
                else {
                    http
                        .get(requestOption, function (resp) {
                            if (resp.statusCode !== 200) {
                                cosoleResp("Disable", requestOption.headers.host + reqPath + reqArray[id].file + " (HOST: " + requestOption.host + ')');
                                reqArray[id].ready = true;
                                reqArray[id].content = '/* File ' + reqArray[id].file + ' Not Found. */';
                                sendData();
                                return;
                            }

                            var buffs = [];
                            resp
                                .on('data', function (chunk) {
                                    buffs.push(chunk);
                                })
                                .on('end', function () {
                                    cosoleResp('Remote', requestOption.headers.host + reqPath + reqArray[id].file + " (HOST: " + requestOption.host + ')');
                                    reqArray[id].ready = true;
                                    var buff = mace.joinBuffer(buffs);

                                    // Fix 80% situation bom problem. Quick and dirty.
                                    if (buff[0] === 239 && buff[1] === 187 && buff[2] === 191) {
                                        buff = buff.slice(3, buff.length);
                                    }

                                    var charset = isUtf8(buff) ? 'utf-8' : 'gbk';
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
