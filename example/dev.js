/**
 * 二次开发示例，更灵活定义功能
 * require("flex-combo/api")
 * */

var http = require("http");
var FlexCombo = require("flex-combo/api");

var fcInst = new FlexCombo();

// 自定义URL解析规则
fcInst.defineParser(function(url) {
    return [];
});
// 添加assets动态编译规则
fcInst.addEngine("\\.suffix$", function(absPath, url) {
    return "";
});

http.createServer(function(req, res) {
    fcInst = new FlexCombo();
    fcInst(req, res, function(){
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.end('Your combo file not found.');
    });
})
.listen(1234);