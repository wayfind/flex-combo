#Flex-combo
The Flex-combo is a javascript and css file combo server. The tool is designed for web front-end developer. It support various kinds of combo format by modify configuration(eg. yahoo combo).
Default, it's a taobao format combo.

#Install
Install flex-combo by `npm install flex-combo` or fork on  github [flexcomb](http://github.com/wayfind/flex-combo)

#Have a try
After install.

```
cd node_modules/flex-combo
node ./test.js
```

Open you browser visit  
`http://127.0.0.1:1337/test/js/??js1.js,js2.js,js3.js`

#Usage
Import module and create module instance and pass a configuration like this:  

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

It meas if a http request start with `http://xxxx.com/test` flex-combo will find file in `./test' directory.

#Command line
If install flex-combo as global mode `npm install -g flex-combo`. There is a command line `flex-combo [options]` to simplely start a combo server base current directory.

    ##YUI combo
    `flex-combo -H yui.yahooapis.com -s combo -e \& -c utf-8`
    
    ##Taobao combo
    `flex-combo` 
see `flex-combo -h` for more info.

