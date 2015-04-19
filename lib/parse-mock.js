module.exports = function (mockConfFile, flexCombo) {

	var fs = require('fs');
	var pathLib = require('path');
	var merge = require("merge");
	var DAC = require('dac');

	// path需要统一
	// absPath
	function getEngine(engineType, path){
		var engineMap = {
			'fetch': DAC.fetch,
			'json': DAC.json,
			'jsonp': DAC.jsonp
		}

		var realPath = (engineType !== 'fetch' ? pathLib.join(process.cwd(), path) : path);

		return engineMap[engineType] && engineMap[engineType](realPath);
	}

	var mockConfig = JSON.parse(fs.readFileSync(mockConfFile));

	for(var urlReg in mockConfig){
		var regx = new RegExp(urlReg);
		if(!regx.test(flexCombo.URL)) continue;

		var map = mockConfig[urlReg].split('|'),
			engineType = map[0],
			filePath = map[1];

		var engine = getEngine(engineType, filePath);

		var urlMatches = flexCombo.URL.match(regx);

		flexCombo.query = merge.recursive({}, flexCombo.query, {matches: urlMatches});

		// built engine
		if(engine) { 
			// 这个addEn
			flexCombo.addEngine(urlReg, engine, filePath, true); 

		// load user custom engine
		} else {
			var js = pathLib.join(process.cwd(), filePath);
			if(fs.existsSync(js) || fs.existsSync(js+'.js')) {
				// 先删除缓存，再require
				delete require.cache[require.resolve(js)];
				flexCombo.addEngine(urlReg, require(js), filePath, true);
			}
		}
	}

	
	
}