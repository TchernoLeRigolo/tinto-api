function TintoApi(api, options) {
	this.api = api;
	this.options = options || {};
	this.options.timeout = this.options.timeout || 5 * 1000;
	this.connections = {};
}

TintoApi.PUBLIC = 0;
TintoApi.PRIVATE = 1;
TintoApi.SHARED = 2;

TintoApi.prototype.start = function(server) {
	var WebSocketServer = require('ws').Server;
	var wss = new WebSocketServer({server: server});
	var util = require('util');
	var self = this;

	wss.on('connection', function(ws) {
		var uuid = self.uuid();
		self.connections[uuid] = ws;
		var welcome = {
			connection: uuid, //uuid of the connection
			api: self.serialize(self.api) //api definition
		}
		
		setTimeout(function() {
			console.log('time out for socket '+ws);
		}, self.options.timeout);

		ws.send(JSON.stringify(welcome));

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

TintoApi.prototype.getFunctionArguments = function(fn) {
	var a = /\(([\s\S]*?)\)/.exec(fn)[1].trim();
	if (0 === a.length) return [];
	return a.split(/[ ,\n\r\t]+/);
}

TintoApi.prototype.serialize = function(api, path) {
	var api_def = {};
	var self = this;
	if (path == null) path = '';

	for (var k in api) {
		if (api.hasOwnProperty(k)) {//k.charAt(0) != '$') {
			var subpath = path + '.' + k;
			var opt = self.options && self.options.paths && self.options.paths[subpath];

			if (api[k].constructor.name === 'Function') {
				if (opt && opt.type !== TintoApi.PRIVATE) {
					var params = self.getFunctionArguments(api[k]);
					
					api_def[k] = {$fn: params, $body: api[k].toString()};
					
				} else if (opt && opt.type === TintoApi.PRIVATE) {
					console.log('private function ' + subpath);
				} else if (!opt || opt.type === TintoApi.PUBLIC) {
					var params = self.getFunctionArguments(api[k]);
					params.shift(); //remove context
					params.pop(); //remove callback
					api_def[k] = {$fn: params};
				}
			} else if (api[k].constructor.name === 'Object') {
				api_def[k] = self.serialize(api[k], subpath);
			} else {
				//simple copy
				api_def[k] = api[k];
			}
		}
	}
	return api_def;
}

TintoApi.prototype.uuid = function() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
	    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
	    return v.toString(16);
	});
}

module.exports = TintoApi;