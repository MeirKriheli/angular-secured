describe("ngSecured", function () {

	var ngSecured,
        ngSecuredProvider,
        $state,
        $rootScope,
        $stateProvider,
        $q,
        $http,
        $httpBackend,
        defaultStateNames,
        cacheOptions,
        $angularCacheFactory,
        stateName = "testState",
        stateParams = {sectionId: '1'},
        loginStateName = "loginState",
        secureState = {secured: {}, url:"/:sectionId" };

    // helper methods
    function getMainCache(){
        return $angularCacheFactory(cacheOptions.cacheKeys.MAIN_CACHE);
    }

    function configureLoginState(){
        ngSecuredProvider.secure({
            loginState: loginStateName
        });
        $stateProvider.state(loginStateName, {});
    }

    function configureNormalState(state){
        if (!state) state = {};
        $stateProvider.state(stateName, state);
    }

	beforeEach(module("ngSecured", "mocks.$angularCacheFactory"));

    beforeEach(module(function(_ngSecuredProvider_, _$stateProvider_){
        $stateProvider = _$stateProvider_;
        ngSecuredProvider = _ngSecuredProvider_;

    }));

	beforeEach(inject(["ngSecured",
                       "$state",
                       "$rootScope",
                       "$q",
                       "ngSecured.defaultStateNames",
                       "ngSecured.cacheOptions",
                       "$angularCacheFactory",
                       "$httpBackend",
                       "$http",
		function (_ngSecured,
                    _$state,
                    _$rootScope,
                    _$q,
                    _defaultStateNames,
                    _cacheOptions,
                    _$angularCacheFactory,
                    _$httpBackend,
                    _$http) {
            ngSecured = _ngSecured;
            $state = _$state;
            $rootScope = _$rootScope;
            $q = _$q;
            defaultStateNames = _defaultStateNames;
            cacheOptions = _cacheOptions;
            $angularCacheFactory = _$angularCacheFactory;
            $httpBackend = _$httpBackend;
            $http = _$http;
	}]));

    describe("transitioning to a state", function () {
        When(function(){
            $rootScope.$apply(function(){
                $state.go(stateName, stateParams);
            });
        });

        describe("insecure state", function () {
            Given(function(){ configureNormalState(); });
            Then(function(){ expect($state.current.name).toBe( stateName ); });
        });

        describe("secure state", function () {
            Given(function(){ configureNormalState(secureState); });

            describe("no login state configured", function () {
                Then(function(){
                    expect($state.current.name).toBe( defaultStateNames.NOT_AUTHENTICATED );
                });
            });
            describe("login state is configured", function () {
                Given(function(){ configureLoginState(); });
                Then(function(){ expect($state.current.name).toBe( loginStateName ); });


                describe("if not authenticated", function () {
                    Given(function(){
                        ngSecuredProvider.secure({
                            isAuthenticated: function(){ return false; },
                            login: function(){}
                        })
                    });
                    Then(function(){ expect($state.current.name).toBe( loginStateName ); });


                    describe("but after login, should continue to the last state and params", function () {

                        When(function(){
                            ngSecuredProvider.secure({
                                isAuthenticated: function(){ return true; },
                                login: function(){ return "admin"; }
                            })
                            ngSecured.loggingIn();
                            $rootScope.$apply();

                        });
                        Then(function(){
                            expect($state.current.name).toBe( stateName );
                            expect($state.params).toEqual( stateParams );
                        });
                    });
                });

                describe("if authenticated", function () {
                    Given(function(){ ngSecuredProvider.secure({
                        isAuthenticated: [function(){ return true; }]
                        })
                    });
                    Then(function(){ expect($state.current.name).toBe( stateName ); });

                    describe("and state is secured with a role", function () {
                        Given(function(){
                            secureState.secured.role = "admin";
                        });

                        describe("if user not authorized", function () {
                            Then(function(){
                                expect($state.current.name).toBe( defaultStateNames.NOT_AUTHORIZED ); });
                        });

                        describe("user is authorized", function () {
                            Given(function(){ ngSecured.setRoles(['admin']); });
                            Then(function(){ expect($state.current.name).toBe( stateName ); });
                        });
                    });
                });
            });
        });

	    describe("should fetch roles", function () {
            Given(function(){ $stateProvider.state(stateName, {}); });

            describe("if fetchRoles is defined and getRoles returns nothing", function () {
                Given(function(){
                    ngSecuredProvider.secure({
                        fetchRoles: function(){
                            return "admin";
                        }
                    })
                });

                xdescribe("if getRoles returns nothing", function () {
                    Given(function(){ ngSecured.setRoles(undefined); });
                    Then(function(){
                        expect(ngSecured.getRoles()).toEqual(['admin']);
                        expect($state.current.name).toBe( stateName );
                    });
                });
                describe("if getRoles returns something", function () {
                    Given(function(){ ngSecured.setRoles(['user']); });
                    Then(function(){ expect(ngSecured.getRoles()).toEqual(['user']) });
                });
            });

            describe("if fetchRoles isn't defined", function () {
                Then(function(){
                    expect(ngSecured.getRoles()).toBeUndefined();
                });
            });
	    });
    });

    describe("config isAuthenticated", function () {
        var isAuthResult;
        When(function(){ isAuthResult = ngSecured.isAuthenticated(); });

        describe("should be able to inject dependencies", function () {
            var $qInjection;
            Given(function(){
                ngSecuredProvider.secure({
                    isAuthenticated: [
                        "$q",
                        function($q){
                            $qInjection = $q;
                        }
                    ]
                })
            });
            Then(function(){ expect($qInjection).toBe($q) });
        });

        describe("if defined", function () {
            var isAuthSpy;
            Given(function(){
                isAuthSpy = jasmine.createSpy();
                ngSecuredProvider.secure({
                    isAuthenticated: isAuthSpy
                })
            });
            Then(function(){
                var mainCache = getMainCache();
                expect(mainCache.get).not.toHaveBeenCalledWith(cacheOptions.cacheKeys.IS_LOGGED_IN);
                expect(isAuthSpy).toHaveBeenCalled();
            });
        });
        describe("if not defined", function () {
            Then(function(){
                var mainCache = getMainCache();
                expect(mainCache.get).toHaveBeenCalledWith(cacheOptions.cacheKeys.IS_LOGGED_IN);
            });

            describe("and localstorage IS_LOGGED_IN is empty", function () {
                Then(function(){
                    expect(isAuthResult).toBe(false);
                });
            });

            describe("and cache is false", function () {
                Given(function(){
                    ngSecuredProvider.secure({
                        cache: false
                    })
                });
                Then(function(){ expect(isAuthResult).toBe(false) });
            });
        });
    });

    describe("setRoles", function () {
        var roles;

        When(function(){ ngSecured.setRoles(roles); });

        describe("one role", function () {
            Given(function(){ roles = "admin" });
            Then(function(){
                var savedRoles = ngSecured.getRoles();
                expect(savedRoles).toEqual(['admin'])
            });
        });
        describe("multiple role", function () {
            Given(function(){ roles = ["admin", 'user'] });
            Then(function(){
                var savedRoles = ngSecured.getRoles();
                expect(savedRoles).toEqual(roles)
            });
            describe("should cache the roles", function () {
                Then(function(){
                    var mainCache = getMainCache();
                    expect(mainCache.put).toHaveBeenCalledWith(cacheOptions.cacheKeys.ROLES, roles);
                });
            });
        });
        describe("set undefined if not array or string", function () {
            Given(function(){ roles = 23; });
            Then(function(){
                expect(ngSecured.getRoles()).toBeUndefined() });
        });
    });

    describe("getRoles should try to get from cache", function () {
        var roles;
        Given(function(){ roles = ["admin"]; });
        When(function(){ roles = ngSecured.getRoles(); });
        Then(function(){
            var mainCache = $angularCacheFactory(cacheOptions.cacheKeys.MAIN_CACHE);
            expect(mainCache.get).toHaveBeenCalledWith(cacheOptions.cacheKeys.ROLES);
        });
        describe("if cahce is false should not try to fetch", function () {
            Given(function(){ ngSecuredProvider.secure({cache: false}) });
            Then(function(){
                var mainCache = getMainCache();
                expect(mainCache.get).not.toHaveBeenCalledWith(cacheOptions.cacheKeys.ROLES);
            });
        });
    });

    describe("includesRole", function () {
        describe("do include role", function () {
            Given(function(){ ngSecured.setRoles(['admin']); });
            Then(function(){ expect(ngSecured.includesRole('admin')).toBe(true); });
        });
        describe("doesn't include a role", function () {
            Then(function(){ expect(ngSecured.includesRole('admin')).toBe(false); });
        });
    });

    describe("loggingIn", function () {

        describe("login is not configured", function () {
            Then(function(){ expect(function(){ ngSecured.login();}).toThrow(); });
        });
        describe("login is configured", function () {

            var credentials = {username: "david", password: "1234"};

            Given(function(){
                ngSecuredProvider.secure({
                    login: function(credentials){}
                })
            });

            When(function(){
                $rootScope.$apply(function(){
                    ngSecured.loggingIn(credentials);
                });
            });

            describe("should pass the credentials to the actual login function", function () {
                var passedCreds;
                Given(function(){
                    ngSecuredProvider.secure({
                        login: function(credentials){
                            passedCreds = credentials;
                        }
                    })
                });
                Then(function(){ expect(passedCreds).toBe(credentials); });
            });

            describe("should inject dependencies", function () {
                var $qInjection;
                Given(function(){
                    ngSecuredProvider.secure({
                        login: ["credentials", "$q", function(credentials, $q){
                            passedCreds = credentials;
                            $qInjection = $q;
                        }]
                    })
                });
                Then(function(){ expect($qInjection).toBe($q) });
            });

            describe("should return a promise", function () {
                var result;
                Given(function(){
                    ngSecuredProvider.secure({
                        login: function(credentials){
                            return "test";
                        }
                    })
                });
                When(function(){
                    $rootScope.$apply(function(){
                        ngSecured.loggingIn().then(function(response){
                            result = response;
                        })
                    })

                });
                Then(function(){ expect(result).toBe('test') });
            });

            describe("should set roles from login invoke result", function () {

                describe("fetchRoles return a value", function () {
                    Given(function(){
                        ngSecuredProvider.secure({
	                        fetchRoles: function(){
                                return "admin";
                            }
                        })
                    });
                    Then(function(){ expect(ngSecured.getRoles()).toEqual(['admin']) });
                });
                describe("fetchRoles return a promise", function () {
                    Given(function(){
                        ngSecuredProvider.secure({
	                        fetchRoles: function(){
                                var defer = $q.defer();
                                defer.resolve("admin");
                                return defer.promise;
                            }
                        })
                    });
                    Then(function(){ expect(ngSecured.getRoles()).toEqual(['admin']) });
                });
            });

            describe("post login state is not defined", function () {
                Then(function(){ expect($state.current.name).toBe(defaultStateNames.NOT_AUTHENTICATED); });
            });

            describe("post login state is defined", function () {
                Given(function(){
                    $stateProvider.state(stateName, {});
                    ngSecuredProvider.secure({
                        postLoginState: stateName
                    });
                    ngSecured._initVars();
                });
                Then(function(){ expect($state.current.name).toBe(stateName); });
            });

        });
    });

    describe("cache", function () {
        var cache;

        Given(function(){ cache = ngSecured._getCacheConfig(); });

        describe("if no cache config was provided", function () {
            Then(function(){
                expect(cache.timeout).toBe(cacheOptions.timeout.FOREVER);
                expect(cache.location).toBe(cacheOptions.location.LOCAL_STORAGE);
            });
        });

        describe("cache forever", function () {
            Given(function(){
                ngSecuredProvider.secure({
                    cache: { timeout: cacheOptions.timeout.FOREVER }
                });
            });
            Then(function(){
                expect(cache.timeout).toBe(cacheOptions.timeout.FOREVER);
            });

        });

        describe("cache location", function () {
            var location;
            Given(function(){ $angularCacheFactory.reset(); });
            describe("localStorage", function () {
                Given(function(){
                    location = cacheOptions.location.LOCAL_STORAGE;
                    ngSecuredProvider.secure({
                        cache: { location: location }
                    });
                    ngSecured._initVars();
                });
                Then(function(){
                    expect($angularCacheFactory).toHaveBeenCalledWith(cacheOptions.cacheKeys.MAIN_CACHE, {storageMode:location});
                });
            });

            describe("sessionStorage", function () {
                Given(function(){
                    location = cacheOptions.location.SESSION_STORAGE;
                    ngSecuredProvider.secure({
                        cache: { location: location }
                    });
                    ngSecured._initVars();
                });
                Then(function(){
                    expect($angularCacheFactory).toHaveBeenCalledWith(cacheOptions.cacheKeys.MAIN_CACHE, {storageMode:location});
                });
            });

        });

        describe("when logging in", function () {
            Given(function(){
                ngSecuredProvider.secure({
                    login: function(){
                        return "success";
                    }
                });
            });
            When(function(){
                $rootScope.$apply(function(){
                    ngSecured.loggingIn();
                });
            });
            describe("should cache the loggedIn state ", function () {
                Then(function(){
                    expect($angularCacheFactory).toHaveBeenCalledWith(cacheOptions.cacheKeys.MAIN_CACHE, {storageMode: cacheOptions.location.LOCAL_STORAGE});
                    var mainCache = getMainCache();
                    expect(mainCache.put).toHaveBeenCalledWith(cacheOptions.cacheKeys.IS_LOGGED_IN, true);

                });
            });

            describe("when no cache", function () {
                Given(function(){
                    $angularCacheFactory.reset();
                    ngSecuredProvider.secure({
                        cache: false
                    });
                });
                When(function(){ ngSecured._initVars(); });
                Then(function(){
                    expect($angularCacheFactory).not.toHaveBeenCalledWith(cacheOptions.cacheKeys.MAIN_CACHE);
                    var mainCache = getMainCache();
                    expect(mainCache.put).not.toHaveBeenCalledWith(cacheOptions.cacheKeys.IS_LOGGED_IN, true);
                });
            });
        });
    });

	describe("fetchingRoles", function () {
		var result;

		describe("fetchRoles is not defined", function () {
			Then(function(){ expect(function (){ ngSecured.fetchingRoles() }).toThrow("fetchRoles is not defined") });
		});

        describe("fetchRoles is defined", function () {
            When(function(){
                $rootScope.$apply(function(){
                    ngSecured.fetchingRoles().then(function(response){
                        result = response;
                    })
                })
            });

            describe("fetchRoles return a normal value", function () {
                Given(function(){
                    ngSecuredProvider.secure({
                        fetchRoles: function(){ return "admin"; }
                    })
                });
                Then(function(){ expect(result).toEqual("admin") });
            });

            describe("fetchRoles can be injected", function () {
                Given(function(){ ngSecuredProvider.secure({
                    fetchRoles: [function(){ return "admin"; }]
                })
                });
                Then(function(){ expect(result).toEqual("admin") });
            });
        });

	});

    describe("loggingOut", function () {
        var logoutSpy,
            logoutPromise,
            reLogin;
        Given(function(){
            reLogin = false;
            logoutSpy = jasmine.createSpy("logoutSpy");
        });
        When(function(){
            $rootScope.$apply(function(){
                logoutPromise = ngSecured.loggingOut(reLogin);
            })
        });

        describe("if logout is defined", function () {
            Given(function(){
                ngSecuredProvider.secure({
                    logout: logoutSpy
                })
            });
            Then(function(){
                expect(logoutSpy).toHaveBeenCalled();
            });

            describe("should inject dependencies", function () {
                var $qInjection;
                Given(function(){
                    ngSecuredProvider.secure({
                        logout: ["$q", function($q){
                            $qInjection = $q;
                        }]
                    })
                });
                Then(function(){ expect($qInjection).toBe($q) });
            });

            describe("should return promise", function () {
                Given(function(){ logoutSpy.andReturn("test") });
                Then(function(){
                    var logoutResult;
                    $rootScope.$apply(function(){
                        logoutPromise.then(function(result){
                            logoutResult = result;
                        });
                    })
                    expect(logoutResult).toBe("test")
                });
            });

            describe("should delete cache", function () {
                Then(function(){
                    var mainCache = $angularCacheFactory(cacheOptions.cacheKeys.MAIN_CACHE);
                    expect(mainCache.removeAll).toHaveBeenCalled();
                });
            });

            describe("should go to postLogoutState", function () {
                var logoutState = "testLogout",
                    loginState = "testLogin";
                Given(function(){
                    $stateProvider.state(logoutState, {});
                    $stateProvider.state(loginState, {});
                    ngSecuredProvider.secure({
                        postLogoutState: logoutState,
                        loginState: loginState
                    })
                });
                Then(function(){ expect($state.current.name).toBe( logoutState ); });

                describe("if relogin is true", function () {
                    Given(function(){ reLogin = true; });
                    Then(function(){
                        expect($state.current.name).toBe( loginState );
                    });
                });
            });
        });

    });

    describe("should relogin On error Http Status", function () {
        Given(function(){
            configureLoginState();
            configureNormalState({url:"/:sectionId"});
            $httpBackend.whenGET("/noAuth").respond(403);
            $rootScope.$apply(function(){
                $state.go(stateName, stateParams);
            })
        });

        When(function(){
            $http.get("/noAuth");
            $httpBackend.flush();
        });

        describe("and status is a number", function () {
            Given(function(){
                ngSecuredProvider.secure({
                    reloginOnHttpStatus: 403
                })
            });

            Then(function(){ expect($state.current.name).toBe(loginStateName) });

            describe("should save last state", function () {
                Given(function(){
                    ngSecuredProvider.secure({
                        isAuthenticated: function(){ return true; },
                        login: function(){ return "admin"; }
                    })
                });
                When(function(){
                    ngSecured.loggingIn();
                    $rootScope.$apply();
                });
                Then(function(){
                    expect($state.current.name).toBe( stateName );
                    expect($state.params).toEqual( stateParams );
                });
            });
        });

        describe("and status is array", function () {
            Given(function(){
                ngSecuredProvider.secure({
                    reloginOnHttpStatus: [403, 404]
                })
                $httpBackend.whenGET("/noAuth2").respond(404);
            });
            Then(function(){
                expect($state.current.name).toBe(loginStateName);
                $rootScope.$apply(function(){ $state.go(stateName) });
                $http.get("/noAuth2");
                $httpBackend.flush();
                expect($state.current.name).toBe(loginStateName);
            });
        });






    });

});