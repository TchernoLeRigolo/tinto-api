function TintoEvent(obj) {
	//an object enhancer allowing for trigger, on listeners...
	obj.listeners = [];

	obj.on = function(event, callback) {
		var l  ={event: event, callback: callback};
		obj.listeners.push(l);

		return {listener: l, remove: function() {
			obj.listeners.splice(obj.listeners.indexOf(l), 1);
		}};
	}

	obj.trigger = function(event) {
		var args = Array.prototype.slice.call(arguments);
		args.shift();
		for (var i=0;i < obj.listeners.length;i++) {
			if (obj.listeners[i].event === event) obj.listeners[i].callback(args);
		}
	}

	return obj;
}

function TintoSocket(url, protocols) {
	//a wrapper for websockets with listeners etc...
	
}

function TintoApi(url, options) {
	var ws;
	var self = this;
	var api = TintoEvent({});
	
	function uuid() {
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
		    return v.toString(16);
		});
	}

	function shallowClear(src, dst) {
		dst = dst || {};

		for (var key in dst) {
			if (key.charAt(0) != '_' && !(dst[key] instanceof Function)) delete dst[key];
		};

		return dst;
	}

	function shallowCopy(src, dst) {
		dst = dst || {};

		for (var key in src) {
			if (src.hasOwnProperty(key) && !(key.charAt(0) === '$' && key.charAt(1) === '$')) {
				dst[key] = src[key];
			}
		}

		return dst;
	}

	function reach(header, context, args) {
		var callback = args.pop();
		header.connection = api.connection;
		header.transaction = uuid();

		if (options.contextResolver) options.contextResolver(context);
		
		ws.send(JSON.stringify({
			header: header,
			context: context, 
			params: args
		}));
	}

	function asSomething(obj, isArray) {
		return function() {
			var r = isArray ? []: {}, callback;
			var args = Array.prototype.slice.call(arguments,0);
			if (args[args.length-1] instanceof Function) callback = args.pop();
			args.push(function(err, result) {
				if (isArray) {
					result.forEach(function(i) {
						r.push(i);
					});
				} else {
					shallowCopy(result, r);
				}
				if (callback) callback(err, result);
			});
			
			obj.apply(obj, args);
			return r;
		}
	}

	function deserialize(api, path) {
		var api_def = {};
		
		for (var k in api) {
				if (api[k].$fn) {
					var context = {};
					/*var b = function() {
						TintoApi.trigger({sid: localStorage.sid, }, path, Array.prototype.slice.call(arguments,0));
					}.toString();
				
					var body = 'var path="'+(path + '.' + k) +'";' + b.substring(b.indexOf("{") + 1, b.lastIndexOf("}"));
					*/
					var args = api[k].$fn.concat([]);
					args.push('callback');
					api_def[k] = function() {
						if (k.charAt(0) == '_') {
							
						} else {
							reach({path: path+'.'+k}, {}, Array.prototype.slice.call(arguments,0));
						}
					}//Function(args, body);
					api_def[k].asArray = asSomething(api_def[k], true);
					api_def[k].asObject = asSomething(api_def[k], false);
				} else if (api[k].constructor.name === 'Object') {
					api_def[k] = deserialize(api[k], (path ? path + '.': '') + k);
				} else {
					api_def[k] = api[k];
				}
		}
		return api_def;
	}

	
	ws = new WebSocket(url);

	ws.onmessage = function(msg) {
		var message = JSON.parse(msg.data);
		if (message.api) {
			var d = deserialize(message.api);
			shallowCopy(d, api);
			api.connection = message.connection;
			api.trigger('ready');
		} else {

		}
	}
	ws.onopen = function() {
		
	}

	return api;
}