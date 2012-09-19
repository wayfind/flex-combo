#Flex-combo
The Flex-combo is combo tool designed for web front-end developer. It support various kinds of combo format by modify configuration(eg. yahoo combo).
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
```http://127.0.0.1:1337/test/js/??js1.js,js2.js,js3.js```

#Useage
Import module:  

```  var flexCombo = require('./flex-combo.js'); ```

Create module instance and pass a configuration like this:  

``` var comboInst = flexCombo({'/test': 'test'}); ```  

It meas if a http request start with `http://xxxx.com/test` flex-combo will find file in `./lib' directory.



