/**
 * 二次开发示例，更灵活定义功能
 * require("flex-combo").API
 * */

var http = require("http");
var API  = require("../").API;

var fcInst = new API({});

// 自定义URL解析规则
//fcInst.defineParser(function (url) {
//  return [url];
//});

// 添加assets动态编译引擎
// 例如要加入stylus支持，可通过addEngine添加动态编译逻辑
fcInst.addEngine("\\.styl$", function (absPath, url, param, callback) {
  callback(null, "/* css content */", absPath, "text/css");
});

http
  .createServer(function (req, res) {
    fcInst.handle(req, res, function () {
      res.writeHead(404, {"Content-Type": "text/plain"});
      res.end("Your combo file not found.");
    });
  })
  .listen(1234, function() {
    console.log("Started!");
  });