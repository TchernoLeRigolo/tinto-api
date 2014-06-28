var fs = require('fs'),
	express = require('express'), 
	http = require('http'),
	path = require('path'),
	TintoApi = require('./../server/index.js')
;

if (process.env.MONGOLAB_URI == null) process.env.MONGOLAB_URI = 'mongodb://localhost/betterwines';

process.env.PUBLIC_DIRECTORY = path.resolve(__dirname);
process.env.PORT = 8080;

var app = express();
app.use(express.static(process.env.PUBLIC_DIRECTORY, { maxAge: 10000000}));
app.get('/tinto-api.js', function(request, response ){
	response.writeHead(200, {'Content-Type': 'application/javascript'});
        
	var fileStream = fs.createReadStream('./../client/tinto-api.js');
    fileStream.pipe(response);
});
//HTTP server
var server = app.listen(process.env.PORT, function() {
	console.log('Node/Express initiated');
});

var names = JSON.parse(fs.readFileSync('first-names.json'));

function getName() {
	return names[Math.round(Math.random() * (names.length-1))];
}

var apiex = {
	CONFIG: {a: 3, b: 2, c: 123456},
	NEWS_TYPES: {
		FOLLOW: 1,
		UNFOLLOW: 2
	},
	User: {
		query: function(context, callback) {
			var result = [];
			for (var i=0;i < 10; i++) result.push({id: i, name: getName()});

			var eventing = function() {
				setTimeout((function() {
					var k = Math.round(Math.random() * result.length * 1.3);
					var e = {id: k, name: getName()};
					
					context.notify(e);
					result.push(e);

					if (result.length < 20) eventing();
				}).bind(this), 3000);
			}
			eventing();

			callback(null, result);
		},
		get: function(context, id, callback) {
			callback(null, {
				id: id,
				name: 'John'
			});
		},
		entourage: function(user) {
			return user.following.concat(user.followers).concat([user.id]);
		}
	},
	Test: function(context, callback) {
		callback();
	},
	Test2: {
		Test3: {
			try: function(context, id, p1, p2, callback) {
				callback();
			}
		},
		add: function(a, b) {
			return a+b;
		}
	}
}

var ta = new TintoApi(apiex, {
	timeout: 30 * 1000,
	contextResolver: function() {

	},
	paths: {
		'CONFIG.c': {
			type: TintoApi.PRIVATE //do not expose CONFIG.c
		},
		'User.entourage': {
			type: TintoApi.SHARED //share function on client
		},
		'Test2.add': {
			type: TintoApi.SHARED //share function on client
		}
	}
});


ta.start(server);
