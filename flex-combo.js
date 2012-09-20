var http = require('http')
, fs = require('fs')
, path = require('path')
, isUtf8 = require('is-utf8')
, iconv = require('iconv-lite')
, util = require('util')
, joinbuffers = require('joinbuffers')
, parse = require('url').parse; 

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
    servlet : '/?',
    seperator: ',',
    charset: 'gbk',
    filter : {
        '\\?t=\\d+':'',
        '-min\\.js$':'\\.js'
    },
    supportedFile: '\\.js|\\.css|\\.png|\\.gif|\\.jpg|\\.swf|\\.xml',
    prjDir: ''
}; 

function adaptCharset(buff, outCharset){
    var charset = isUtf8(buff) ? 'utf8' : 'gbk';
    if (charset === outCharset) {
        return buff;
    }

    return iconv.encode(iconv.decode(buff, charset), outCharset);    
}

function filterUrl(url){
    var filter = param.filter;
    var filtered = url;
    for(fk in filter){
        filtered = filtered.replace(fk, filter[fk]);
    }
    return filtered;
}

/*
 * 根据一个文件的全路径(如：/xxx/yyy/aa.js)从本地文件系统获取内容
 */
function readFromLocal (fullPath) {
    var map = param.urls,  charset = param.charset;
    var longestMatchNum = -1 , longestMatchPos = null;
    for(k in map){
        var matchN = fullPath.indexOf(k);
        if(matchN > longestMatchNum) {
            longestMatchNum = matchN; 
            longestMatchPos = k;
        }
    }
    if(!longestMatchPos){ return null }

    var dirs = map[longestMatchPos].split(',');
    for (var i = 0, len = dirs.length; i < len; i++){
        var dir = dirs[i];
        var revPath = fullPath.slice(longestMatchPos.length, fullPath.length);
        var absPath = path.normalize(path.join(param.prjDir, dir, revPath));
        if(fs.existsSync(absPath)){
            var buff = fs.readFileSync(absPath);
            return adaptCharset(buff, param.charset);
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


exports = module.exports = function(prjDir, urls, options){
    if(urls){
        param.urls = merge(param.urls, urls);
    }
    if(options){
        options.urls = param.urls;
        param = merge(param, options);
    }
    param.prjDir = prjDir;
   var fileReg = new RegExp(param.supportedFile);
    return function(req, res, next) {
        //远程请求的域名不能和访问域名一致，否则会陷入请求循环。
        if(req.headers.host === param.host){
            return;
        }
        var url = req.url;
        var prefix = url.indexOf(param.servlet + '?');
        //不包含combo的servlet，认为是单一文件
        if(prefix === -1){
            //combo不处理html文件，但是需要接管其他资源
            if(!fileReg.test(url)) {
                next();
                return;
            }

            var filteredUrl = filterUrl(url);
            var singleFileContent = readFromLocal(filteredUrl);

            if(singleFileContent){
                res.end(singleFileContent);
                return;
            }

            //本地没有，从服务器获取  
            //console.log('send http request:'+ param.host+ url);
            http.get({host: param.host, port: 80, path: url}, function(resp) {
                var buffs = [];
                resp.on('data', function(chunk) {
                    buffs.push(chunk);
                });
                resp.on('end', function() {
                    var buff = joinbuffers(buffs);
                    var charset = isUtf8(buff) ? 'utf8' : 'gbk';

                    var singleFileContent = adaptCharset(buff, param.charset);
                    res.end(singleFileContent );
                    return;
                });
            }).on('error',function(e){
                //console.log('Networking error:' + e.message);
                return;
            });
            return;
        }
        prefix = url.substring(0, prefix);
        //console.log(prefix+'|'+param.servlet);
        var files = url.substring(prefix.length + param.servlet.length + 1, url.length);
        //console.log(files);
        files = files.split(param.seperator, 1000);

        var reqArray = [];
        var prevNeedHttp = false ;//为循环做准备，用来判定上次循环的file是否需要通过http获取
        var needHttpGet = '';
        for(var i = 0, len = files.length; i < len; i++){
            var file = files[i];
            //combo URL有时候会多一个逗号
            if(file === "") continue;
            var fullPath = filterUrl(path.join(prefix, files[i]));
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
            (function(id) {
                //console.log('define request: '+ reqArray[i].file);
                http.get({host: param.host, port: 80, path: url}, function(resp) {
                    var buffs = [];
                    //console.log('request: ' + reqPath+reqArray[id].file);
                    resp.on('data', function(chunk) {
                        buffs.push(chunk);
                    });
                    resp.on('end', function() {
                        reqArray[id].ready = true;
                        var buff = joinbuffers(buffs);
                        reqArray[id].content = adaptCharset(buff, param.charset);
                        sendData();
                    });
                }).on('error',function(e){
                    //console.log('Networking error:' + e.message);
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
