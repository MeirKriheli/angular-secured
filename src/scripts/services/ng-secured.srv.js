angular.module("ngSecured")
    .provider("ngSecured", ["$stateProvider", function ($stateProvider) {

        var baseStateName = "private__ngSecured",
            defaultStateNames = {
                "BASE_STATE": baseStateName,
                "NOT_AUTHENTICATED": baseStateName + ".notAuthenticated",
                "NOT_AUTHORIZED": baseStateName + ".notAuthorized"
            },
            config = {
                loginState: defaultStateNames.NOT_AUTHENTICATED,
                unAuthorizedState: defaultStateNames.NOT_AUTHORIZED,
                isAuthenticated: function () {
                    return false
                },
                postLoginState: defaultStateNames.NOT_AUTHENTICATED,
	            fetchRoles: undefined
            };

        $stateProvider.state(defaultStateNames.BASE_STATE, {});
        $stateProvider.state(defaultStateNames.NOT_AUTHENTICATED, {views: {"@": {template: "please login to see this page."}}});
        $stateProvider.state(defaultStateNames.NOT_AUTHORIZED, {views: {"@": {template: "You are not authorized to see this page."}}});


        this.secure = function (userConfig) {
            angular.extend(config, userConfig);

        }

        this.$get = ["$rootScope", "$state", "$q", "$injector",
            function ($rootScope, $state, $q, $injector) {

                var lastStateName,
                    lastStateParams,
                    roles;

                function initVars() {
                    lastStateName = config.postLoginState;
                }

                initVars();

                $rootScope.$on("$stateChangeStart", function (event, toState, toParams) {

                    if (config.fetchRoles && !getRoles()){
                        event.preventDefault();
                        fetchingRoles().then(function(){
                            $state.go(toState, toParams);
                        });
                    }else{
                        guardStateTransition(event, toState, toParams);
                    }
                })

                function guardStateTransition(event, toState, toParams){
                    if (!!toState.secured) {

                        if (!isAuthenticated()) {
                            event.preventDefault();
                            lastStateName = toState.name;
                            lastStateParams = toParams;
                            $state.go(config.loginState);
                        } else if (toState.secured.hasOwnProperty("role")) {

                            if (!roles || roles.indexOf(toState.secured.role)) {
                                event.preventDefault();
                                $state.go(config.unAuthorizedState);
                            }
                        }

                    }
                }

                function goToLastState() {
                    if (lastStateName) {
                        $state.go(lastStateName, lastStateParams);
                    }
                }

	            function fetchingRoles(){
                   if (!config.fetchRoles){
                       throw new Error("fetchRoles is not defined");
                   }
                    var rolesFetchResult = $injector.invoke(config.fetchRoles);

                    return $q.when(rolesFetchResult).then(
                        function (rolesValue) {
                            if (rolesValue) {
                                setRoles(rolesValue);
                            }
                            return rolesValue;
                        }
                    )

	            }

                function isAuthenticated(){
                    return $injector.invoke(config.isAuthenticated);
                }

                function getRoles(){
                    return roles;
                }

	            function setRoles(rolesValue) {
		            if (angular.isString(rolesValue)) {
			            roles = [rolesValue];
		            } else if (!angular.isArray(rolesValue)) {
			            roles = undefined;
		            } else {
			            roles = rolesValue;
		            }
	            }

                return {
                    defaultStateNames: defaultStateNames,
                    _initVars: initVars,

                    login: function (credentials) {

                        if (!config.login) {
                            throw new Error("login function must be configured");
                        } else {
                            var loginPromise = $q.when($injector.invoke(config.login, config, {credentials: credentials}));

                            loginPromise.then(function(result){
                                if (config.fetchRoles){
                                    fetchingRoles().then(function(){
                                        goToLastState();
                                    });
                                }else{
                                    goToLastState();
                                }
                            })
	                        return loginPromise;
                        }
                    },

                    isAuthenticated: isAuthenticated,

                    setRoles: setRoles,

                    getRoles: getRoles,

                    includesRole: function (role) {
                        if (roles && roles.indexOf(role) !== -1) {
                            return true;
                        }
                        return false;
                    },
	                fetchingRoles: fetchingRoles

                }
            }];
    }])