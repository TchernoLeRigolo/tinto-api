localStorage.sid = 9999999123456;

angular.module('TintoApiTest', ['ngAnimate'])
	.directive('animateOnChange', function($animate) {
	  return function(scope, elem, attr) {
	      scope.$watch(attr.animateOnChange, function(nv,ov) {
	        if (nv!=ov) {
	          var c = 'change';
	          $animate.addClass(elem,c, function() {
	            $animate.removeClass(elem,c);
	          });
	        }
	      })  
	  }  
	})
	.controller('TintoApiTestController', function($rootScope, $scope) {
		var api = new TintoApi('ws://localhost:8080', {
			/*
			Context is passed as header to the server and can be used to resolve the session etc
			*/
			contextResolver: function(context, callback) {
				context.sid = localStorage.sid;
				callback(null, context);
			},
			/*
			Hook applied after reception of data from the server
			*/
			after: function() {
				$scope.$apply();
			}
		});

		api.on('ready', function() {
			console.log(api);
		});
		
		$scope.startTests = function() {
			api.User.get(123, function(err, result) {
				$scope.user = result;
			});

			//query as Array, and let api User.query know I want updates and to insert/update them by 'id'
			//if ($scope.users) $scope.users.unsubscribe();//if I run test twice, clear subscription first
			$scope.users = api.User.query.asArray().subscribe('id');
			$scope.users.on('itemAdded', function(item) {
				$scope.lastAction = 'Item ' + item.name + ' added';
			});
			$scope.users.on('itemDeleted', function(item) {
				$scope.lastAction = 'Item ' + item.name + ' deleted';
			});
			$scope.users.on('itemUpdated', function(item, old) {
				$scope.lastAction = 'Item ' + old.name + ' updated to ' + item.name;
			});
			
			$scope.user2 = api.User.get.asObject(111);
		};

		$scope.resetTests = function() {
			$scope.user = null;
			$scope.user2 = null;
			$scope.users = null;
		}
	});