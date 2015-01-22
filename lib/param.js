module.exports = {
  hosts: {
    "a.tbcdn.cn": "115.238.23.240",
    "g.tbcdn.cn": "115.238.23.250",
    "s.tbcdn.cn": "115.238.23.198"
  },
  cache: true,
  headers: {},
  servlet: '?',
  seperator: ',',
  charset: "utf-8",
  urlBasedCharset: {},
  urls: {},
  engine: {},
  filter: {
    "[\\.-]min\\.js$": ".js",
    "[\\.-]min\\.css$": ".css"
  },
  define: "KISSY.add",
  anonymous: false,
  debug: false
};