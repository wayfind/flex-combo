module.exports = {
  rootdir: "src",
  urls: {},
  charset: "utf-8",
  urlBasedCharset: {},
  hosts: {
    "g.tbcdn.cn": "115.238.23.250",
    "g.alicdn.com": "115.238.23.250"
  },
  cache: true,
  headers: {},
  servlet: '?',
  seperator: ',',
  traceRule: '',
  filter: {
    "[\\.\\-]min\\.js$": ".js",
    "[\\.\\-]min\\.css$": ".css"
  },
  engine: {},
  "dac/tpl": {
    define: "KISSY.add",
    anonymous: false,
    filter: {}
  }
};