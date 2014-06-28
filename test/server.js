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

var apiex = {
	CONFIG: {a: 3, b: 2, c: 123456},
	NEWS_TYPES: {
		FOLLOW: 1,
		UNFOLLOW: 2
	},
	User: {
		query: function(context, callback) {
			var result = [
				{id: 1, name: 'John', following: [5,6], followers: [3,4]},
				{id: 2, name: 'Mat', following: [6], followers: [1,4]},
				{id: 3, name: 'Alf', following: [4], followers: [6,4]},
				{id: 4, name: 'Judith', following: [1,2], followers: [3,4]},
				{id: 5, name: 'Josh', following: [], followers: [3,6]},
				{id: 6, name: 'Sara', following: [4], followers: [3,5]}
			];

			for (var i = 0; i < 5; i++) {
				setTimeout((function() {
					var k = Math.round(Math.random() * 20);
					if (k > 6) context.notify({id: k, name: 'New user '+k, following: [], followers: []})
					if (k < 7) context.notify({id: k, name: 'Updated user'+k, following: [], followers: []})
				}).bind(this), 3000 + i * 3000);
			}

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