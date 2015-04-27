var merge = require("merge");

exports = module.exports = function () {
  var trace = [];

  function push(obj) {
    trace.push(merge.recursive(true, {time: new Date()}, obj));
  }

  return {
    request: function (host, files) {
      push({
        type: "request",
        host: host,
        list: files
      });
    },
    response: function (input) {
      push({
        type: "response",
        url: input
      });
      process.emit("flex-combo", trace);
    },
    error: function (input, tip) {
      push({
        type: "error",
        msg: input,
        tip: tip || "Exception"
      });
    },
    warn: function (input, tip) {
      push({
        type: "warn",
        msg: input,
        tip: tip || "Exception"
      });
    },
    engine: function (url, path) {
      push({
        type: "engine",
        url: url,
        path: path
      });
    },
    local: function (url, path) {
      push({
        type: "local",
        url: url,
        path: path
      });
    },
    filter: function (regx, ori_url, _url) {
      push({
        type: "filter",
        regx: regx,
        before: ori_url,
        after: _url
      });
    },
    cache: function (url, path) {
      push({
        type: "cache",
        url: url,
        path: path
      });
    },
    remote: function (url, opt) {
      opt = merge.recursive(true, {
        protocol: "http:",
        host: "127.0.0.1",
        path: "/fake",
        port: 80,
        headers: {
          host: "localhost"
        }
      }, opt);
      push({
        type: "remote",
        url: url,
        reqopt: opt
      });
    }
  }
};
