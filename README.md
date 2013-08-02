# Flex Combo 介绍

## 介绍

Combo技术最初出现源于[《高性能网站建设指南》](http://book.douban.com/subject/3132277/)的规则一所提到“减少HTTP请求"，是一个在服务端提供，合并多个文件请求在一个响应中的技术。
在生产环境中，Combo功能有很多实现，例如[Tengine](http://tengine.taobao.org/document_cn/http_concat_cn.html)。 
在前端开发环境中，由于最终上线需要将资源引入的代码合并，从而无法在本地轻量开发调试，引起开发调试不便。
Flex Combo是在开发环境模拟实现了此功能的服务器，目的是方便前端开发调试。约等于一个支持Combo语法，只能访问js/css及图片资源的Apache服务器。
区别于生产环境的Combo。Flex Combo专为前端开发环境量身打造，舍弃部分高并发特性，从而提供了丰富的功能和轻量的体积。

## 安装
安装为命令

	npm install -g flex-combo

或者安装到某个项目

	npm install flex-combo
      
##快速上手

```
cd node_modules/flex-combo
node ./test.js
```

打开浏览器访问以下地址：
`http://127.0.0.1:1337/test/js/??js1.js,js2.js,js3.js`

## lib开发模式

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

以上，就在本地1337端口启动了flex-combo服务。

## 特性

### 轻量可配置

轻松支持多种类型combo。可以通过灵活的参数配置，支持多种类型的Combo语法。如支持yahoo风格的combo。
![](http://img04.taobaocdn.com/tps/i4/T1d448FndXXXXgVCfH-611-365.png)

### 与线上combo环境协作

前端开发过程中，有时必须引入部分线上存在但本地工程无需关注的资源，例如网站全站范围统一使用的前端框架jQuery、Kissy等。
Flex combo，遇到自己没有的资源时，会真正到线上服务器获取内容。Flex Combo会动态分析请求描述的文件列表。本地有的，采用本地内容返回，本地没有的，构造Combo请求到线上服务器获取内容。最后将本地内容和线上内容合并返回。这样做，保证最终上线后combo请求的内容顺序和调试期完全一致。
![](http://img04.taobaocdn.com/tps/i4/T1ye85Fg8eXXXhTOTo-570-438.png)

### 完全本地开发

所有到线上combo请求过的内容都会缓存在本地。下次访问时直接从本地获取。这个过程对前端开发者来说是透明的。只是会感觉第一次发起combo请求稍慢一些。这样，前端开发项目，只需要在项目建成的第一次，向Flex Combo请求一次资源，后续就再用无需网络，从而离线开发了。
![](http://img02.taobaocdn.com/tps/i2/T1ohh6FmxcXXX06.PE-714-548.png)

### 扁平化本地目录及多目录挂接

Flex Combo允许把本地目录挂接到任意url上。这个特性让前端在面临/apps/xxxx/yyy/zzz这样深度目录请求时，无需在本地创建同样深度的目录。

![](http://img01.taobaocdn.com/tps/i1/T11d47FX0cXXabys_j-669-370.png)

多个url挂接点，这个特性使前端工程可以更加灵活。

![](http://img01.taobaocdn.com/tps/i1/T1IFX5FchfXXaQk2Md-598-190.png)

### 编码处理

在经典Combo功能中，如果请求的多个文件以不一致的方式编码，存在GBK和UTF8混杂的情况。Combo功能讲不同编码格式的内容合并到一齐返回。目前生产环境中，js代码上线前会经过压缩和转码，此问题不会暴露出来。但是在前端开发环境中，返回的前端代码为了可读性不应被压缩和编码，一旦出现混合编码的情况，这种不便就会暴露出来。在淘宝实际应用中，kissy是utf8编码，而其他业务级js都是gbk编码，如果，前端需要返回kissy的可调试代码的话，这个问题会变的很严重。

![](http://img01.taobaocdn.com/tps/i1/T1jn86FllbXXbqNQkk-634-351.png)

Flex Combo对这个技术细节做了周详考虑。Flex Combo内部提供了基于内容的编码探测机制。根据文件内容确定编码格式，一旦发现混合编码的情况，就将不符合要求的编码内容，就将起转换为输出编码格式。输出编码格式是可用户自定义的，目前支持UTF8和GBK两种。

### 灵活易扩展

Flex Combo是一个connect组件，可以于connect生态系统的其他组件一起组合出更多功能。

![](http://img02.taobaocdn.com/tps/i2/T1dmX6FlFdXXX0GGTA-712-399.png)

### 易用

Flex Combo不但是一个组件库，同时也是一个命令行工具。如果不想写脚本做扩展，可以通过一个命令享受到本地Combo的好处。

## 命令参数
用法: flex-combo [options]

  Options 如下:

    -d, --dir [string]        本地目录。默认情况下是执行命令的当前目录。
    -u, --url [string]        本地目录映射URL。例如：传入/apps/et本地目录被映射到/apps/et下。这意味着只有当一个请求以/apps/et开头时，才会本地目录中寻找文件，本地目录由dir参数所指定的。
    -H, --host [string]       服务器域名。如果文件不在本地，将到此域名处请求文件。
    -s, --servlet [string]    Combo的servlet。对于淘宝而言是"?",对yahoo而言是"combo"。默认是"?"
    -e, --seperator [string]  文件分隔符。默认为","
    -c, --charset [string]    http响应数据的编码方式。默认为gbk。
    -p, --port [string]       启动web服务的端口

在项目目录下执行`flex-combo`而不带任何参数时，将以项目目录为根目录建立Combo服务器。
## 高阶命令参数

 除了通过命令行设置参数。flex-combo还支持配置文件，配置文件将支持更加丰富的特性。一般来说flex-como会在第一次运行时生成一份默认配置文件到`~/.flex-combo/config.json`, windows用户请到自己当前登录用户目录寻找这个文件。该文件以严格的JSON结构保存，编辑时一定要保证格式合法性。flex-combo的参数可以通过命令行、nodejs函数调用参数以及配置文件的三种方式配置。在同时使用三种方式配置参数的情况下，参数的优先级为命令行>配置文件>nodejs函数调用参数。
 
 一份完整的配置如下
 
 ```
 {
    "urls": {
        "/xxx":"/Users/david/xxxproject"
     },
    "headers": {"host":"a.tbcdn.cn"},
    "hostIp": "115.238.23.241",
    "host": "assets.taobaocdn.com",
    "servlet": "?",
    "seperator": ",",
    "charset": "gbk",
    "filter": {
        "\\?.+": "",
        "-min\\.js$": ".js",
        "-min\\.css$": ".css"
    },
    "supportedFile": "\\.js|\\.css|\\.png|\\.gif|\\.jpg|\\.swf|\\.xml|\\.less",
    "urlBasedCharset": {},
    "hosts":{"a.tbcdn.cn":"122.225.67.241", "g.tbcdn.cn":"115.238.23.250"}
}
 ```
#### urls
urls参数是一个对象，指定需要代理路径。key表示需要被代理的url，value表示这个url将被映射到的本地硬盘路径。如上边配置所示`"/xxx":"/Users/david/xxxproject"`表示，所有以`/xxx`开头的请求都会从本地`/Users/david/xxxproject`目录中寻找文件。即就是请求`127.0.0.1/xxx/a.js`，返回`/Users/david/xxxproject/a.js`。支持子目录。

urls是对象，可以配置多个。如：

```
{
    "/xxx":"/Users/david/xxxproject",
    "/yyy":"/Users/david/yyyproject"
}
```

这样将支持`/xxx`的请求到`/Users/david/xxxproject`获取内容，`/yyy`的请求到`/Users/david/yyyproject`获取内容。

当配置多个url映射时。有可能出现两个url同时符合两个规则。 如：

```
{
    "/xxx":"/Users/david/xxxproject",
    "/xxx/aaa":"/Users/david/yyyproject"
}
```
flex-combo将根据**最长匹配**原则，选择最合适规则访问资源文件。上面例子中，如果请求`/xxx/aaa/b.js`,虽然同时符合两项规则，但最终生效规则是字符串最长的那项，也就是`"/xxx/aaa":"/Users/david/yyyproject"`，`/xxx/aaa/b.js`会从`/Users/david/yyyproject"`获取。

urls参数对前端开发灵活的在本地支持多个项目有重要意义。在实际项目中，可以灵活运用配置文件全局参数和命令行参数以获取开发便利性。

#### host相关参数
flex-combo支持请求资源不在本地在时去某个服务器请求所需资源。host相关参数是决定服务器的关键参数。
与host有关的参数有4个。`host`、`hostIp`、`headers`、`hosts`

* `host`参数是一个域名，表示请求不存在时需要转发的资源服务器。一般情况下，以淘宝为例，一般资源是通过`a.tbcdn.cn`域名访问，但是资源还可以通过`assets.taobaocdn.com`访问。这样同样IP配置了多个域名的情况下，只需要配置`host`为`assets.taobaocdn.com`就可以。因为一般情况下我们会将常用域名的host修改为`127.0.0.1`，这种情况下我们通过另外一个域名访问真实环境的资源。

* 通过IP访问。如果资源服务器没有额外域名。 flex-combo支持以`hostIp`+`headers`的方式定义host。`hostip`必须是一个IP地址。如：`"hostip": "10.11.23.1"`。一般互联网公司的资源服务器都不支持直接IP访问，必须配置http头。headers定义了向此ip发起http请求时候必须设置的http头信息。http头信息以JSON的方式定义。如：

```
   "headers": {"host":"a.tbcdn.cn"},
```

* 多资源服务器转发。以淘宝为例a.tbcdn.cn的请求需要转发到某个IP。g.tbcdn.cn的请求需要转发到另外一个IP。`hosts`参数允许配置多组域名、IP组信息。以便选择合适的服务器转发。`hosts`参数是一个对象，其中key表示域名，value表示IP。例如：

```
"hosts":{"a.tbcdn.cn":"122.225.67.241", "g.tbcdn.cn":"115.238.23.250"}
``` 

将根据发送请求的http头host信息。匹配合适的转发IP。如果请求为`a.tbcdn.cn/a.js`将转发到`122.225.67.241`。如果请求为`g.tbcdn.cn/a.js`。将转发到`115.238.23.250`

#### combo规则相关参数
不同的开发环境有不同的combo需求。通过`servlet`,`seperator`,两个参数决定。

#### 编码参数
`charset` 设置flex-combo返回数据的编码集。只能设置为`gbk`或者`utf-8`。该设置与源文件编码集无关。flex-combo假设源文件只有`gbk`系列编码和`utf-8`两种型式。会自动探测源文件是否utf-8。因此你可以在一个combo链接中同时引入utf-8和gbk编码的文件而不会出错。

`urlBasedCharset` 可针对某一个url设置响应字符集。例如：

```
    "charset" : "utf-8",
    "urlBasedCharset" : {"/apps/aaa.js":"gbk"}
```

允许在大多数情况下返回字符集为utf-8字符集的资源。但在访问/apps/aaa.js的情况下，以gbk的方式编码。
这个特性多被用来引入编码几不同的第三方脚本。

#### 过滤器
`filter` 配置可以用来过滤传入url。`filter`配置是一个对象，其中key是匹配的正则表达式，value是替换的字符串，支持正则表达式变量。替换的顺序与定义无关。这个设置可被用来在替换访问压缩的js文件为原文件。做到开发者友好。

#### 支持文件扩展名
`supportedFile`可以定义支持的文件扩展名列表。

## FAQ 
1.  为什么会提示`Error: listen EACCES`。  
     Flex combo使用80端口建立前端服务器，在Linux、Mac下使用80端口需要root权限。解决这个问题的方法是使用`sudo flex-combo [options]`的方式运行。
2.   为什么会提示`Error: listen EADDRINUSE`。  
Flex Combo所需要使用的端口正在被使用中，如果这个端口是80端口，你需要检查系统中是否有其他web容器，比如Apache、Nginx等是否使用了80端口。如果不是，你需要检查是否系统中有其他Flex Combo正在运行。
