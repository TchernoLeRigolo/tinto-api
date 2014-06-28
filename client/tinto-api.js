function TintoEvent(obj) {
	//an object enhancer allowing for trigger, on listeners...
	obj.listeners = [];

	obj.on = function(event, callback) {
		var l  ={event: event, callback: callback};
		obj.listeners.push(l);

		return {listener: l, remove: function() {
			obj.listeners.splice(obj.listeners.indexOf(l), 1);
		}};

		if (obj.listenerAdded) obj.listenerAdded(event);
	}

	obj.trigger = function(event) {
		var args = Array.prototype.slice.call(arguments);
		args.shift();
		for (var i=0;i < obj.listeners.length;i++) {
			if (obj.listeners[i].event === event) obj.listeners[i].callback.apply(obj, args);
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
	this.subscriptions = [];

	var api = TintoEvent({});
	api.options = options;
	api.listenerAdded = function(key) {
		if (key === 'ready' && api.connection) api.trigger('ready');
	}
	
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

	function timeInfo(obj, tm) {
		if (Array.isArray(obj)) {
			obj.forEach(function(i) {
				i.$timestamp = new Date();
				i.$responsetime = new Date() - tm;
			});
		} else {
			obj.$timestamp = new Date();
			obj.$responsetime = new Date() - tm;
		}
	}

	function reach(caller, header, context, argsArray) {
		var callback;
		if (argsArray[argsArray.length-1] instanceof Function) callback = argsArray.pop();
		header.connection = api.connection;
		header.transaction = uuid();

		if (options.contextResolver) options.contextResolver(context);
		var t = new Date();
		var l;
		l = ws.on('message', function(message) {
			if (message.header.transaction === header.transaction) {
				timeInfo(message.result, t);
				if (callback) callback(message.error, message.result);
				if (api.options.after) api.options.after();
				l.remove();
			}
		});

		caller.message = {
			header: header,
			context: context, 
			params: argsArray
		};

		ws.send(caller.message);
	}

	function asSomething(obj, isArray) {
		return function() {
			var r = isArray ? []: {}, callback;
		
			var args = Array.prototype.slice.call(arguments,0);
			var argsSignature = JSON.stringify(args);
			if (args[args.length-1] instanceof Function) callback = args.pop();

			args.push(function(err, result) {
				if (isArray) {
					r.splice.apply(r, [0, 0].concat(result));
				} else {
					shallowCopy(result, r);
				}
				r.$resolved = true;
				if (callback) callback(err, result);
			});
			
			obj.apply(obj, args);
			r.$resolved = false;
			r.subscribe = function(id, insert) {
				r.subscriberLisener = ws.on('message', function(message) {
					if (message.notification && r.$resolved && message.header.transaction === obj.message.header.transaction) {
						if (isArray) {
							var found = false;
							
							r.forEach(function(i) {
								if (i[id] === message.notification[id]) {
									shallowCopy(message.notification, i);
									i.$timestamp = new Date();
									found = true;
								}
							});
							if (!found) {
								var newObj = {};
								shallowCopy(message.notification, newObj);
								newObj.$timestamp = new Date();

								if (!insert || insert === 'after') r.push(newObj);
								if (insert === 'before') r.push(newObj);
								if (insert instanceof Function) insert(r, newObj);
							}
						} else {
							if (r[id] == message.notification[id]) {
								shallowCopy(message.notification, r);
								r.$timestamp = new Date();
							}
						}

						if (api.options.after) api.options.after();
					}
				});

				self.subscriptions.forEach(function(s) {
					if (s.path === obj.path && s.args === argsSignature) {
						//we already have a subscription for this!
						s.listener.remove();
						self.subscriptions.splice(self.subscriptions.indexOf(s), 1);
					}
				});

				self.subscriptions.push({
					path: obj.path,
					args: argsSignature,
					listener: r.subscriberLisener
				});
				
				return r;
			}

			r.unsubscribe = function() {
				if (r && r.subscriberLisener) r.subscriberLisener.remove();
			}

			return r;
		}
	}

	function deserialize(api, path) {
		var api_def = {};
		
		for (var k in api) {
				if (api[k].$fn) {
					var context = {};
					var args = api[k].$fn.concat([]);
					args.push('callback');
					
					api_def[k] = function() {
						var args = Array.prototype.slice.call(arguments,0);
						return reach(this, {path: arguments.callee.path}, {}, args);
					}

					api_def[k].path = path+'.'+k;
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

	
	ws = TintoEvent(new WebSocket(url));
	ws.onmessage = function(message) {
		ws.trigger('message', JSON.parse(message.data));
	}
	ws.onclose = function() {
		ws.trigger('close');	
	}
	ws.onopen = function() {
		ws.trigger('open');	
	}
	ws.oldSend = ws.send;
	ws.send = function(obj) {
		this.oldSend(JSON.stringify(obj));
	}

	//TODO: add on open and remove on close
	ws.on('message', function(message) {
		if (message.api) {
			var d = deserialize(message.api);
			shallowCopy(d, api);
			api.connection = message.connection;
			api.trigger('ready');
		}
	});

	ws.on('open', function() {
		
	});

	return api;
}