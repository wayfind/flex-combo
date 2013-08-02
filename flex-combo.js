var http = require('http')
    , fs = require('fs')
    , path = require('path')
    , isUtf8 = require('is-utf8')
    , iconv = require('iconv-lite')
    , joinbuffers = require('joinbuffers')
    , mkdirp = require('mkdirp')
    , crypto = require('crypto')
    , beautify = require('./beautify.js').js_beautify
    , util = require('util')
    , mime = require('mime');


var debug = require('debug')('flex-combo:debug');
var debugInfo = require('debug')('flex-combo:info');
var green   = '\u001b[32m';
var red   = '\u001b[31m';
var blue  = '\u001b[34m';
var gray = '\u001b[37m';
var yellow = '\u001b[33m';
var reset = '\u001b[0m';

function cosoleResp(type, c){
    if(type == "Need"){
        console.log('%s=>Need: %s%s%s  %s',green, reset, blue, c, reset);
        return;
    }
    if(type == 'Not found'){
        console.log(red+'<='+type+': ' + reset + gray + ' ' + c + ' ' + reset);
        return;
    }
    if(type == 'Actually'){
        console.log(green+'  -'+type+': ' + reset + gray + ' ' + c + ' ' + reset);
        return;
    }
    console.log(green+'<='+type+': ' + reset + gray + ' ' + c + ' ' + reset);
    return;
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
    urls: {},
    host : 'assets.taobaocdn.com',
    servlet : '?',
    seperator: ',',
    charset: 'gbk',
    filter : {
        '\\?.+':'',
        '-min\\.js$':'.js',
        '-min\\.css$':'.css'
    },
    supportedFile: '\\.js|\\.css|\\.png|\\.gif|\\.jpg|\\.swf|\\.xml|\\.less',
    prjDir: '',
    urlBasedCharset:{},
    fns:[],
    hosts:{'a.tbcdn.cn':'122.225.67.241', 'g.tbcdn.cn':'115.238.23.250'}
};

function adaptCharset(buff, outCharset, charset){
    if (charset === outCharset) {
        return buff;
    }

    return iconv.encode(iconv.decode(buff, charset), outCharset);
}

function filterUrl(url){
    var filter = param.filter;
    var filtered = url;
    for(var fk in filter){
        filtered = filtered.replace(new RegExp(fk), filter[fk]);
    }
    if(param.fns){
        param.fns.forEach(function(fn){
            try{
                filtered = fn(filtered);
            }
            catch(e){

            }
        });
    }
    cosoleResp('Actually', filtered);
    return filtered;
}

function isBinFile(fileName){
    fileName = fileName.split('?')[0];
    return !/.js$|.css$|.less$/.test(fileName);
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
function readFromLocal (fullPath) {
    fullPath = fullPath.split('?')[0];
    var longestMatchPos = longgestMatchedDir(fullPath);
    if(!longestMatchPos){ return null }

    //找到最长匹配的配置，顺序遍历已定义好的目录。多个目录用逗号","分隔。
    var map = param.urls;
    var dirs = map[longestMatchPos].split(',');
    for (var i = 0, len = dirs.length; i < len; i++){
        var dir = dirs[i];
        var revPath = fullPath.slice(longestMatchPos.length, fullPath.length);
        var absPath = '';

        //如果是绝对路径，直接使用
        if(dir.indexOf('/') === 0 || /^\w{1}:\\.*$/.test(dir)){
            absPath = path.normalize(path.join(dir, revPath));
        }
        else{
            absPath = path.normalize(path.join(param.prjDir, dir, revPath));
        }

        if(fs.existsSync(absPath)){
            var buff = fs.readFileSync(absPath);
            if(isBinFile(absPath)){
                cosoleResp('Local', absPath);
                return buff;
            }
            var charset = isUtf8(buff) ? 'utf8' : 'gbk';

            //允许为某个url特别指定编码
            var outputCharset = param.charset;
            if(param.urlBasedCharset && param.urlBasedCharset[longestMatchPos]){
                outputCharset = param.urlBasedCharset[longestMatchPos];
            }
            cosoleResp('Local', absPath);
            return adaptCharset(buff, outputCharset, charset);
        }
    }
    return null;
}

var merge = function(dest, src) {
    for (var i in src) {
        dest[i] = src[i];
    }
    return dest;
}

var cacheFile = function(fullPath, content, encode){
    var absPath = path.join(param.cacheDir, fullPath);
    var lastDir = path.dirname(absPath);
    if(/[<>\*\?]+/g.test(absPath)){
        debugInfo('Exception file name: can not cache to %s',absPath);
        return;
    }
    if(!fs.existsSync(lastDir)){
        debug('%s is not exist',lastDir);
        mkdirp(lastDir, function(){
            fs.writeFileSync(absPath, content);
        });
        return;
    }
    fs.writeFileSync(absPath, content);
}

var readFromCache = function(url, fullPath){
    var absPath = path.join(param.cacheDir, fullPath);
    if(fs.existsSync(absPath)){
        var buff = fs.readFileSync(absPath);
        if(isBinFile(absPath)){
            cosoleResp('Cache', absPath);
            return buff;
        }
        var charset = isUtf8(buff) ? 'utf8' : 'gbk';

        //允许为某个url特别指定编码
        var outputCharset = param.charset;
        var longestMatchPos = longgestMatchedDir(url);
        if(longestMatchPos){
            if(param.urlBasedCharset && param.urlBasedCharset[longestMatchPos]){
                outputCharset = param.urlBasedCharset[longestMatchPos];
            }
        }
        cosoleResp('Cache', absPath);
        return adaptCharset(buff, outputCharset, charset);
    }
    return null;
}

function buildRequestOption(url, req) {
    var requestOption = {host: param.host, port: 80, path: url};
    //处理IP加Request Header的情况
    if (param.hostIp && param.headers) {
        requestOption.host = param.hostIp;
        requestOption.headers = param.headers;
    }
    if (param.hosts) {
        for (hostName in param.hosts) {
            if (req.headers.host == hostName) {
                requestOption.host = param.hosts[hostName];
                if (!requestOption.headers) {
                    requestOption.headers = {};
                }
                requestOption.headers.host = hostName;
                break;
            }
        }
    }
    return requestOption;
}
exports = module.exports = function(prjDir, urls, options){
    var userHome = process.env.HOME || process.env.HOMEPATH;//兼容windows
    var cacheDir = path.join(userHome, '.flex-combo/cache');
    if(!fs.existsSync(cacheDir)){
        mkdirp(cacheDir);
    }
    var userConfigPath = path.join(userHome, '.flex-combo/config.json');
    if(!fs.existsSync(userConfigPath)){
        if(!fs.existsSync(path.join(userHome,'.flex-combo'))){
            mkdirp.sync(path.join(userHome,'.flex-combo'));
        }
        fs.writeFileSync(userConfigPath, beautify(JSON.stringify(param)));
    }
    else{
        var paramStr = fs.readFileSync(userConfigPath);
        paramStr.toString().replace(/[\n\r]/g, '');
        param = merge(param, JSON.parse(paramStr));
    }
    param.cacheDir = cacheDir;
    if(urls){
        param.urls = merge(param.urls, urls);
    }
    if(options){
        options.urls = param.urls;
        param = merge(param, options);
    }
    param.prjDir = prjDir;
    debug(util.inspect(param));

    var fileReg = new RegExp(param.supportedFile);
    return function(req, res, next) {
        //远程请求的域名不能和访问域名一致，否则会陷入请求循环。
        if(req.headers.host === param.host){
            return;
        }
        var url = req.url.replace(/http:\/\/.+?\//,'/');//兼容windows,windows平台下取得的req.url带http://部分
        var prefix = url.indexOf(param.servlet + '?');

        //不包含combo的servlet，认为是单一文件
        if(prefix === -1){
            //combo不处理html文件，但是需要接管其他资源
            if(!fileReg.test(url)) {
                next();
                return;
            }
            cosoleResp('Need', url);
            var filteredUrl = filterUrl(url);
            res.setHeader('Content-Type', mime.lookup(filteredUrl.split('?')[0]));
            var singleFileContent = readFromLocal(filteredUrl);

            if(singleFileContent){
                res.end(singleFileContent);
                return;
            }

            var fileName = crypto.createHash('md5').update(req.headers.host+url).digest('hex');
            var cachedFile = readFromCache(filteredUrl, fileName);
            if(cachedFile){
                res.end(cachedFile);
                return;
            }

            //本地没有，从服务器获取
            var requestOption = buildRequestOption(url, req);

            http.get(requestOption, function(resp) {
                var buffs = [];
                if(resp.statusCode !== 200){
                    cosoleResp('Not found', requestOption.host + requestOption.path + ' (host:'+ reset + yellow + requestOption.headers.host + reset + ')');
                    res.end('File ' + requestOption.host + requestOption.path + ' not found.');
                    return;
                }
                resp.on('data', function(chunk) {
                    buffs.push(chunk);
                });
                resp.on('end', function() {
                    var buff = joinbuffers(buffs);

                    //fix 80% situation bom problem.quick and dirty
                    if(buff[0] === 239 && buff[1] === 187 && buff[2] === 191) {
                        buff = buff.slice(3, buff.length);
                    }
                    if(isBinFile(filteredUrl)){
                        var binfileName = crypto.createHash('md5').update(req.headers.host+requestOption.path).digest('hex');
                        cacheFile(binfileName, buff);
                        cosoleResp('Remote', requestOption.host + requestOption.path);
                        res.end(buff);
                        return;
                    }
                    cosoleResp('Remote', requestOption.host + requestOption.path);
                    var charset = isUtf8(buff) ? 'utf8' : 'gbk';
                    var longestMatchPos = longgestMatchedDir(filteredUrl);

                    //允许为某个url特别指定编码
                    var outputCharset = param.charset;
                    if(longestMatchPos){
                        if(param.urlBasedCharset && param.urlBasedCharset[longestMatchPos]){
                            outputCharset = param.urlBasedCharset[longestMatchPos];
                        }
                    }

                    var singleFileContent = adaptCharset(buff, outputCharset, charset);
                    var fileName = crypto.createHash('md5').update(req.headers.host+url).digest('hex');
                    cacheFile(fileName, buff, charset);
                    res.end(singleFileContent );
                    return;
                });
            }).on('error',function(e){
                    debugInfo('Networking error:' + e.message);
                    res.writeHead(404, { 'Content-Type': 'text/html;charset=utf-8'});
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
        var prevNeedHttp = false ;//为循环做准备，用来判定上次循环的file是否需要通过http获取
        var needHttpGet = '';
        for(var i = 0, len = files.length; i < len; i++){
            var file = files[i];

            //combo URL有时候会多一个逗号
            if(file === "") continue;
            var fullPath = prefix + filterUrl(files[i]);
            if(i === 0 ){
                res.setHeader('Content-Type', mime.lookup(fullPath.split('?')[0]));
            }

            var fileContent = readFromLocal(fullPath);
            if(!fileContent){
                if(prevNeedHttp){
                    needHttpGet += ',' + file;
                    continue;
                }
                prevNeedHttp = true;
                needHttpGet = file;
                continue;
            }
            if(prevNeedHttp){
                reqArray.push({file: needHttpGet, ready: false});
            }
            prevNeedHttp = false;
            reqArray.push({file: file, content: fileContent, ready: true});
        }

        if(prevNeedHttp){
            reqArray.push({file: needHttpGet, ready:false});
        }

        var reqPath = prefix + param.servlet + '?';
        for(var i = 0, len = reqArray.length; i < len; i++){
            if(reqArray[i].ready){
                continue;
            }
            var cacheName = crypto.createHash('md5').update(req.headers.host+reqArray[i].file).digest('hex');
            var cachedContent = readFromCache(reqArray[i].file, '/' + cacheName);
            if(cachedContent){
                reqArray[i].content = cachedContent;
                reqArray[i].ready = true;
                continue;
            }

            (function(id) {
                var requestPath = reqPath + reqArray[id].file;
                var requestOption = buildRequestOption(requestPath, req);
                http.get(requestOption, function(resp) {
                    if(resp.statusCode !== 200){
                        debugInfo('Remote not found: %s', reqPath + reqArray[id].file);
                        reqArray[id].ready = true;
                        reqArray[id].content = 'File '+ reqArray[id].file +' not found.';
                        sendData();
                        return;
                    }

                    var buffs = [];
                    resp.on('data', function(chunk) {
                        buffs.push(chunk);
                    });
                    resp.on('end', function() {
                        cosoleResp('Remote', requestOption.host + reqPath + reqArray[id].file);
                        reqArray[id].ready = true;
                        var buff = joinbuffers(buffs);

                        //fix 80% situation bom problem.quick and dirty
                        if(buff[0] === 239 && buff[1] === 187 && buff[2] === 191) {
                            buff = buff.slice(3, buff.length);
                        }
                        var fileName = crypto.createHash('md5').update(req.headers.host+reqArray[id].file).digest('hex');
                        var charset = isUtf8(buff) ? 'utf8' : 'gbk';
                        reqArray[id].content = adaptCharset(buff, param.charset, charset);
                        cacheFile('/' + fileName, buff, charset);
                        sendData();
                    });
                }).on('error',function(e){
                        reqArray[id].ready = true;
                        debug('Networking error:' + e.message);
                    });
            })(i);
        }

        var sendData = function(){
            for(var j = 0, len = reqArray.length; j < len; j++){
                if(reqArray[j].ready === false){
                    return;
                }
            }
            reqArray.forEach(function(reqNode){
                res.write(reqNode.content);
            });
            res.end();
        }

        //如果全部都在本地可以获取到，就立即返回内容给客户端
        sendData();
    }
}

