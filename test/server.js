var fs = require('fs'),
	express = require('express'), 
	http = require('http'),
	path = require('path'),
	tintoApi = require('./../server/index.js')
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
	$CONFIG: {a: 3, b: 2, $c: 123456},
	NEWS_TYPES: {
		FOLLOW: 1,
		UNFOLLOW: 2
	},
	User: {
		query: function(context, callback) {
			callback(null, [
				{id: 1, name: 'John'},
				{id: 1, name: 'Mat'},
				{id: 1, name: 'Alf'},
				{id: 1, name: 'Judith'},
				{id: 1, name: 'Josh'},
				{id: 1, name: 'Sara'}
			]);
		},
		get: function(context, id, callback) {
			callback(null, {
				id: id,
				name: 'John'
			});
		}
	},
	Test: function(context, callback) {},
	Test2: {
		Test3: {
			try: function(context, id, p1, p2, callback) {
			}
		}
	}
}

tintoApi(apiex, {}).start(server);