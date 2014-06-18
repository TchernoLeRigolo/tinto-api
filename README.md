tinto-api (coming soon in alpha)
================================
> This project is initiating. Come back for v0.1 somewhere in July
> Some info here are personal notes still
> Requires modern browsers with websockets

A client-server RPC mechanism for node and javascript clients with no boilerplate. Define an API on the server, connect to it using the client library and use the API right away.

#Usage

An API is defined on the Server (Node) as a Javascript Object with properties. These properties may be Primitives, Objects or Functions. Objects and Primitives are simply exposed to the client, whilst the Functions are available through RPC.

##On the server

First define an API, for example:
```javascript
var api = {
	SomeInfo: {A: 3, B: 2, $C: 1}, //C is private and not available to the client
	_SomeFunc:  function(a, b) {return a+b}, //function available on the client
	User: {
		get:  function(context, id, callback) {
			db.User.getById(id, callback);//pseudo code , get user in DB
		},
		$get: function(token, callback) {// prefixed with $ => server side only
			db.User.get({token: token}, callback);//pseudo code , get user in DB
		},
		query: function(context, name, callback) {
			db.User.query({name: name}, callback);//pseudo code , get user with name in DB
		},
		$insert: function(context, name, password, callback) {// prefixed with $ => server side only
			//some code
		}
	},
	...
}
```

Make this API available to the client by initializing it:


```javascript
var http = require('http'),
    tintoApi = require('tinto-api')
    ;
var server = http.createServer(app).listen();
new tintoApi(server, api, options);
```


##On the client
```javascript
var api = new TintoApi('ws://localhost', options);
api.ready(function() { //bootstrap your code so the API is ready to take calls
	
	//constants & objects (not functions)
	console.log(api.SomeInfo.A); //-> 3
	console.log(api.SomeInfo.C); //-> null/undefined

	//get user with callback
	api.User.get(1234, function(err, user) {
		console.log(user);
	});

	//get user as an object (useful for frameworks with data binding capabilities)
	var someVar = api.User.get.asObject(1234);
	
	var someOtherVar = api.User.query.asArray('john');
});
```



#Installation

* On the server: npm install tinto-api --save

* On the client: bower install tinto-api --save


#Documentation


#Options

* contextResolver - a function which resolves the context further
* Other...


##Context Resolver

All API functions (available to the client) need to conform to the following structure:

```javascript
function(context, arg1, arg2, arg…, callback)
```

The context variable allows for context information to be provided, such as a session token, the user linked to the 

session, or any other information typically linked to a user session. The context mechanism is fully customizable.

This example uses the context resolver to bind a token on the client stored in localStorage to a user on the 

server, readily available in the API functions as 'context.user'

###On the client
```javascript
{
	contextResolver: function(context, callback) {
		context.token = localStorage.token;
		callback(null, context);
	}
}
```

###On the server

```javascript
{  
	//contextResolver is optional, yet you will need it most of the time
	contextResolver: function(context, callback) {
		api.User.$get(context.token, function(err, user) {
			if (err) {
				callback(err);
				return;
			} else {
				context.user = user;
				callback(null, context);
			}
		}
	}
}
```

#Private Functions (proposal)

The API allows for private members (using $). These functions are only available to the server.

```javascript
api.Test.$add = function(a,b) {
	return a+b;
}
```

#Shared Functions (proposal)

The API allows for private members (using $) but also allows for sharing a function between the server and the client (using _)
```javascript
api.Test._add = function(a,b) {
	return a+b;
}
```
Will they be available as ‘add’ or as ‘_add’ on the client?

> (test in browser OK): new Function([‘a’, ‘b’], ‘return a+b’)(2,3)  6

#Eventing & broadcasting (proposal)

The usage of websockets allows us to push info to the client at will. This requires two things: an original event such as an insertion in a database, and resolving the audience of clients this event is to be broadcasted to. 

> Internally, there is a list of contexts. They reference the sockets.

In the api, you would for example create a register function:

```javascript
//This will broadcast any user change to all clients
api.User.register = function(context) {
	context.register(db.User.on(‘save’, function(err, user) {
		if (!err) context.notify({id: user._id, name: user.name});	
	}));
}

//This will broadcast any user change to certain clients
api.User.register = function(context) {
	context.register(db.User.on(‘save’, function(err, user) {
context.notify(context.user.following, {id: user._id, name: user.name});		
	}));
}
```

The register function will attach the provided listener to the context so that the websocket onclose event will trigger the destruction of all the listeners related to Events & Syncing in order to free up resources.

When initiating tinto-api, you will need to specify how the audience needs to be resolved (in the options):

```javascript
audienceResolver: function(ids, contexts) {
	//return the list of contexts part of the audience
	return contexts.filter(function(context) {
		if (ids.indexOf(context.user._id) > -1) return true;
});
}
```

#Syncing (proposal)
```javascript
api.User.get(1234).sync();
```

Sync sends a message to the server to ‘sync’ on api.User.get this calls the API api.User.get but with a sync callback in the context.

```javascript
api.User.query.asArray({firstName: ‘John’}, clb).sync({id: ‘_id’, insert: ‘prepend’})
```
does sync send a second message?

R should hold the context. 
The context should hold the token, the path and the transaction id.

sync will send same message as asArray but with {sync: true} in the context.

```javascript
api.Post.sync(context, …) {
	db.Post.on(‘save’, function(err, post) {
		var audience = context.user.followers.concat([context.user.following]).concat([context.user._id])
		if (audience.indexOf(post.by)) context.broadcast(err, user);

api.User.query(context, …,  clb)
```

#License
The MIT License (MIT)
