module.exports = function(api, options) {
	function getFunctionArguments(fn) {
		var argumentsRegExp = /\(([\s\S]*?)\)/;
		var replaceRegExp = /[ ,\n\r\t]+/;
		var fnArguments = 	argumentsRegExp.exec(fn)[1].trim();
		if (0 === fnArguments.length) return [];
		return fnArguments.split(replaceRegExp);
	}

	function serialize(api) {
		var api_def = {};
		for (var k in api) {
			if (k.charAt(0) != '$') {
				if (api[k].constructor.name === 'Function') {
					var params = getFunctionArguments(api[k]);
					params.shift(); //remove context
					params.pop(); //remove callback
					api_def[k] = {$fn: params};
				} else if (api[k].constructor.name === 'Object') {
					api_def[k] = serialize(api[k]);
				} else {
					//simple copy
					api_def[k] = api[k];
				}
			}
		}
		return api_def;
	}

	return {
		start: function(server) {
			var WebSocketServer = require('ws').Server, wss = new WebSocketServer({server: server});
			var util = require('util');

			wss.on('connection', function(ws) {
				console.log('connection');
				var apid = JSON.stringify(serialize(api));
				console.log(apid);
				ws.send(apid);

				ws.on('message', function(message) {
					var d = Date.now();
					try {
						var message = JSON.parse(message);
					} catch(e) {
						//NOT JSON
					}
				
					console.log(message);
				});
			});
		}
	}
}