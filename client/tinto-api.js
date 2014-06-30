//An object wrapper for eventing (on, trigger)
function TintoEvent(obj) {
	var listeners = [];

	obj.on = function(event, callback) {
		var l  = {event: event, callback: callback};
		listeners.push(l);

		return {listener: l, remove: function() {
			listeners.splice(listeners.indexOf(l), 1);
		}};

		if (event !== 'listenerAdded') obj.trigger('listenerAdded');
	}

	obj.trigger = function(event) {
		var args = Array.prototype.slice.call(arguments);
		args.shift();
		for (var i=0;i < listeners.length;i++) {
			if (listeners[i].event === event) listeners[i].callback.apply(obj, args);
		}
	}

	return obj;
}

/*
TintoSocket(url, protocols)
 - Wrapper for the Websocket object providing the following added services:
   * Automatic JSON serializing/deserializing
   * Eventing as defined in TintoEvent for Open, Close, Error and Message events
   * Enumeration of socket ready states
   * Connection & resume packets sending...
*/
function TintoSocket(url, protocols) {
	this.url = url;
	this.protocols = protocols;
	
	TintoEvent(this);
}

TintoSocket.CONNECTING = 0;
TintoSocket.OPEN = 1;
TintoSocket.CLOSING = 2;
TintoSocket.CLOSED = 3;

TintoSocket.prototype.open = function() {
	var self = this;
	var ws = new WebSocket(this.url);

	ws.onmessage = function(message) {
		self.trigger('message', JSON.parse(message.data));
	}
	ws.onclose = function() {
		self.trigger('close');
	}
	ws.onopen = function() {
		self.trigger('open');
	}
	ws.onerror = function() {
		self.trigger('error');
	}

	this.ws = ws;
}

TintoSocket.prototype.send = function(obj) {
	if (this.ws.readyState == TintoSocket.OPEN) {//OPEN
		this.ws.send(JSON.stringify(obj));
	} else {
		var l = this.on('open', function() {
			this.ws.send(JSON.stringify(obj));
			l.remove();
		});
		this.open();
	}
}


/* TintoApi (url, options)
	
*/
function TintoApi(url, options) {
	var ws;
	var self = this;
	this.subscriptions = [];

	var api = TintoEvent({});
	api.options = options;
	api.on('listenerAdded', function(key) {
		if (key === 'ready' && api.connection) api.trigger('ready');
	});
	
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

	function remoteCall(caller, header, context, argsArray) {
		var callback;
		if (argsArray[argsArray.length-1] instanceof Function) callback = argsArray.pop();
		header.connection = api.connection;
		header.transaction = uuid();

		var applySend = function(context) {
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

		if (options.contextResolver) {
			options.contextResolver(context, function(err, context) {
				applySend(context);
			});
		} else {
			applySend(context);
		}
	}

	function asSomething(obj, isArray) {
		return function() {
			var r = TintoEvent(isArray ? []: {}), callback;
		
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
							if (message.context.event === 'new') {
								var newObj = {};
								shallowCopy(message.notification, newObj);
								newObj.$timestamp = new Date();

								if (!insert || insert === 'after') r.push(newObj);
								if (insert === 'before') r.push(newObj);
								if (insert instanceof Function) insert(r, newObj);
								r.trigger('itemAdded', newObj);
							} else if (message.context.event === 'update') {
								r.forEach(function(i) {
									if (i[id] === message.notification[id]) {
										r.trigger('itemUpdated', message.notification, i);
										shallowCopy(message.notification, i);
										i.$timestamp = new Date();
									}
								});
							} else if (message.context.event === 'delete') {
								var index = null;
								for (var i=0;i<r.length;i++) {
									if (r[i][id] === message.notification[id]) {
										index=i;
										break;
									}
								}
								if (index) {
									r.trigger('itemDeleted', r[index]);
									r.splice(index, 1);
								}
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

	function deserializeApi(api, path) {
		var api_def = {};
		
		for (var k in api) {
			if (api[k].$fn) {
				var context = {};
				var args = api[k].$fn.concat([]);
				args.push('callback');
				
				api_def[k] = function() {
					var args = Array.prototype.slice.call(arguments,0);
					return remoteCall(this, {path: arguments.callee.path}, {}, args);
				}

				api_def[k].path = path+'.'+k;
				api_def[k].asArray = asSomething(api_def[k], true);
				api_def[k].asObject = asSomething(api_def[k], false);
			} else if (api[k].constructor.name === 'Object') {
				api_def[k] = deserializeApi(api[k], (path ? path + '.': '') + k);
			} else {
				api_def[k] = api[k];
			}
		}

		return api_def;
	}

	ws = new TintoSocket(url);
	ws.open();

	//TODO: add on open and remove on close
	ws.on('message', function(message) {
		console.log(message);
		if (message.api) {
			var d = deserializeApi(message.api);
			shallowCopy(d, api);
			api.connection = message.connection;
			api.trigger('ready');
		}
	});

	return api;
}