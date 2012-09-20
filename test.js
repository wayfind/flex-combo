var http = require('http');
var flexCombo = require('./flex-combo.js');
var comboInst = flexCombo(__dirname, {'/test': 'test'});
http.createServer(function (req, res) {
    comboInst(req, res, function(){
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end('Hello World\n');
    })
}).listen(1337, '127.0.0.1');
console.log('Flex Combo Server running at http://127.0.0.1:1337/');
