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
			contextResolver: function(context) {
				context.sid = localStorage.sid;
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
			
			$scope.user2 = api.User.get.asObject(111);
		};

		$scope.resetTests = function() {
			$scope.user = null;
			$scope.user2 = null;
			$scope.users = null;
		}
	});