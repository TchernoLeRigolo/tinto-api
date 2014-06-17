tinto-api
=========

A client-server mechanism for node and javascript clients - no REST, no HTTP, no boilerplate

#What it does

Define an API on the server. Connect to it using the client library and use the API right away.

#Usage:

##On the server:

First define an API, for example:
```javascript
var api = {
	SomeInfo: {A: 3, B: 2, $C: 1}, //C is private and not available to the client
	User: {
		get:  function(context, id, callback) {
			db.User.getById(id, callback);//pseudo code , get user in DB
		},
		$get: function(token, callback) {// prefixed with $ => server side only
			db.User.get({token: token}, callback);//pseudo code , get user in DB
		}
		
		$insert: function(context, name, password, callback) {// prefixed with $ => server side only
			//some code
		}
	},
	...
}
```

Make this API available to the client by initializing it:


```
new TintoApi(server, api, options); //server is the http connection
```


##On the client:
```
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

```
function(context, arg1, arg2, arg…, callback)
```

The context variable allows for context information to be provided, such as a session token, the user linked to the 

session, or any other information typically linked to a user session. The context mechanism is fully customizable.

This example uses the context resolver to bind a token on the client stored in localStorage to a user on the 

server, readily available in the API functions as 'context.user'

###On the client
```
{
	contextResolver: function(context, callback) {
		context.token = localStorage.token;
		callback(null, context);
	}
}
```

###On the server

```
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

