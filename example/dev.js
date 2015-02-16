/**
 * 二次开发示例，更灵活定义功能
 * require("flex-combo").API
 * */

var http = require("http");
var API  = require("flex-combo").API;

// 自定义URL解析规则
API.prototype.defineParser(function (url) {
  return [];
});

// 添加assets动态编译引擎
// 例如要加入stylus支持，首先要在配置文件supportedFile中加入相应后缀匹配\\.styl$，然后通过addEngine添加动态编译逻辑
API.prototype.addEngine("\\.styl$", function (absPath, url, param, callback) {
  callback(err, text, [filepath]);
});

http
  .createServer(function (req, res) {
    var fcInst = new API();
    fcInst.handle(req, res, function () {
      res.writeHead(404, {"Content-Type": "text/plain"});
      res.end("Your combo file not found.");
    });
  })
  .listen(1234);