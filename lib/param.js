module.exports = {
  rootdir: "src",
  urls: {},
  charset: "utf-8",
  urlBasedCharset: {},
  hosts: {
    "a.tbcdn.cn": "115.238.23.240",
    "g.tbcdn.cn": "115.238.23.250",
    "s.tbcdn.cn": "115.238.23.198"
  },
  cache: true,
  headers: {},
  servlet: '?',
  seperator: ',',
  engine: {},
  filter: {
    "[\\.-]min\\.js$": ".js",
    "[\\.-]min\\.css$": ".css"
  },
  define: "KISSY.add",
  anonymous: false,
  traceRule: ''
};