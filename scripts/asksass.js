var readline = require("readline");
var fs = require("fs");
var exec = require("child_process").exec;

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question(" - Do you want to install node-sass? [y/N]", function(answer) {
  if (answer.toLowerCase() == 'y') {
    console.log("node-sass is installing");

    var json = JSON.parse(fs.readFileSync("./package.json"));
    json.dependencies['node-sass'] = "latest";
    fs.writeFileSync("./package.json", JSON.stringify(json, null, 2));

    var proc = exec("npm install node-sass", function (err) {
      if (err !== null) {
        console.log("exec error: " + err);
      }
    });
    proc.stdout
      .on("data", function (data) {
        console.log(data);
      })
      .on('end', function () {
        console.log("node-sass installed");
      });
  }

  rl.close();
});