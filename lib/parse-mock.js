module.exports = function (mockConfFile, flexCombo) {

	var fs = require('fs');
	var pathLib = require('path');
	var DAC = require('dac');

	function getEngine(path){
		var engineType = inspectEngineType(path);

		var engineMap = {
			'fetch': DAC.fetch,
			'json': DAC.json
		}

		var realPath = pathLib.join(process.cwd(), path);
		return engineMap[engineType] && engineMap[engineType](realPath);
	}

	function inspectEngineType(val){
		if(/http:\/\//.test(val)) {
			return 'fetch';
		} else if(/\.json$/.test(val)) {
			return 'json';
		} else {
			return 'custom-engine';
		}
	}

	var mockConfig = JSON.parse(fs.readFileSync(mockConfFile));

	// 解析，并加入到引擎中
	for(var urlReg in mockConfig){
		// TODO 
		var path = mockConfig[urlReg];

		// 符合提供的engine
		var engine = getEngine(path);
		
		if(engine) { 
			console.log('built engine');
			flexCombo.addEngine(urlReg, engine) 
		} else {
			// custom engine
			console.log('custom engine');
			var js = pathLib.join(process.cwd(), path);
			if(fs.existsSync(js) || fs.existsSync(js+'.js')) {
				flexCombo.addEngine(urlReg, require(js));
			}
		}
	}

	
	
}