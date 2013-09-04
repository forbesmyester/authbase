/* globals describe, it */

var userRoute = require('../routes/user.js'),
	SFDb = require('../libs/SFDb.js'),
	expect = require('expect.js'),
	libCrypto = require('../libs/utils.crypto.js'),
	sinon = require('sinon'),
	efvarl = require('../libs/efvarl.js'),
	appConfig = require('../config'),
	ResponseSelector = require('../libs/ResponseRouter');

var convertMustacheErrorToOb = function(errors) {
	var r = {},
		i = 0;
	for (i=0;i<errors.length;i++) {
		r[errors[i].field] = errors[i].message;
	}
	return r;
};

var mockGenerateRandomString = function(l, next) {
	var r = '';
	while (r.length < l) {
		r = r + 'a';
	}
	return next(0, r);
};

var mockHasher = function(str, next) {
	next(0, str.split('').reverse().join(''));
}

var mockCheckAgainstHash = function(inputted, hashedPassword, next) {
	if (inputted.split('').reverse().join('') == hashedPassword) {
		return next(0, true);
	}
	return next(0, false);
};

var doRegistration = function(name, email, color, next) {
	
	return next('myId', email, 'aaaa');
	
	var db = require('mongoskin').db(
			appConfig.database_host +
				':' +
				appConfig.database_port +
				'/' +
				'syncitserv_user_js',
			{w:1}
		);

	var responseFunc = function() {
		db.collection(userRoute.USER_COLLECTION).findOne(
			{email:email},
			function(err,result) {
				expect(result.email).to.equal(email);
				next(result._id,result.email,result.activationPad);
			}
		);
	};
	
	var req = {body: {name: name, email: email, color: color }};
	
	userRoute.register.process(req, {}, responseFunc);
	
};

var getNewResponseSelector = function() {
	return new ResponseSelector({
		format: 16,
		controller: 8,
		action: 4,
		method: 2,
		httpStatus: 1
	});
};

describe('user.register is saying',function() {
	
	var db = require('mongoskin').db(
			appConfig.database_host +
				':' +
				appConfig.database_port +
				'/' +
				'syncitserv_user_js',
			{w:1}
		),
		sFDb = SFDb.createInstance(db);

	it('will show the login screen for HTML only',function() {
		
		var req = {
			cookies: {
				idauth: 'hi'
			},
			accepts: function() {
				return 'application/json';
			}
		};
		var res = {
			send: sinon.spy(),
			render: sinon.spy()
		};

		var responder = sinon.spy();

		var response = 'json';

		var getResponseFormat = function() {
			return response;
		};
		
		userRoute.register.get(
			{},
			getResponseFormat,
			req,
			res,
			responder
		);
		expect(responder.calledOnce).to.equal(true);
		expect(responder.lastCall.args[0]).to.eql('not_acceptable');

		response = 'html';
		
		req.accepts = function() { return 'text/html'; };
		userRoute.register.get(
			{},
			getResponseFormat,
			req,
			res,
			responder
		);
		expect(responder.calledTwice).to.equal(true);
		expect(responder.lastCall.args[0]).to.eql('ok');
		
	});

});

describe('Registration says',function() {
	
	it('will on post do basic validation on the users input (not async)',function() {
		
		var reqs = {
			email_a: { // Invalid Email
				accepts: function() {return 'text/html'; },
				body: {name: 'Jack Jenkins', email: 'jack.jenkins.hisdomain.com', color: 'red'}
			},
			email_b: { //No Email
				accepts: function() {return 'text/html'; },
				body: {name: 'Jack Jenkins', email: '', color: 'red'} },
			color_a: { // No Color
				accepts: function() {return 'text/html'; },
				body: {name: 'Jack Jenkins', email: 'jack.jenkins@hisdomain.com', color: ''}
			},
			name_a:{ // No Name
				accepts: function() {return 'text/html'; },
				body: {name: '', email: 'jack.jenkins@hisdomain.com', color: 'red'}
			}
		};
		
		var res = {
			send: sinon.spy(),
			render: sinon.spy()
		};
		
		var responder = sinon.spy();
		
		var callCount = 0;
		for (var k in reqs) {
			if (reqs.hasOwnProperty(k)) {
				userRoute.register.process(
					{},
					efvarl,
					null,
					null,
					null,
					reqs[k],
					res,
					responder
				);
				expect(
					Object.getOwnPropertyNames(responder.args[callCount][2])
				).to.eql(
					[k.replace(/_.*/,'')]
				);
				expect(responder.callCount).to.equal(++callCount);
			}
		}
		
	});
	
	describe('if validation is unsuccessful',function() {
		
		var req = {
			accepts: function() {return 'text/html'; },
			body: {name: 'Jack Jenkins', email: 'jackjenkineszzz@abc.com'}
		};
	
		it('will feed back error information and your own data', function(done) {
			var responseFunc = function(status,data,vErrors,bErrors) {
				expect(vErrors.hasOwnProperty('color')).to.equal(true);
				done();
			};
			userRoute.register.process(
				{},
				efvarl,
				null,
				null,
				null,
				req,
				{},
				responseFunc
			);
		});
	});
		
	describe('if validation is successful',function() {
		var email = 'jack.'+(new Date().getTime())+'.jenkins@hisdomain.com';
		
		var req = {
			accepts: function() {return 'text/html'; },
			body: {name: 'Jack Jenkins', email: email, color: 'red'}
		};
		
		it('will create a user and send activation email if an email does not exist',function(done) {
			
			var to = null;
			var data = null;
			
			var mockEmailSender = function(config, from, ito, subjectTemplate, textTemplate, idata, next) {
				to = ito;
				data = idata;
				next(0);
			};
			
			var responseFunc = function(status,data,vErrors,bErrors) {
				expect(to).to.equal(email);
				expect(data._id).to.match(/^aa/);
				expect(data.hasOwnProperty('activationPad')).to.equal(false);
				done();
			};
			
			var sFDb = { inserts: [] };
			// sFDb.successfulModifyOne = function(collection, query, update, options, callback)
			sFDb.insert = function(collection, document, next) {
				setTimeout(function() {
					sFDb.inserts.push({
						document: document,
						collection: collection
					});
					next(SFDb.ERROR.OK);
				},1);
			};
			
			userRoute.register.process(
				appConfig,
				efvarl,
				mockEmailSender,
				mockGenerateRandomString,
				sFDb,
				req,
				{},
				responseFunc
			);
			
		});
		
		it('attempting to create a user which already exists will only update' +
			'the activationPad and send an activationPad email',function(done) {
				
			var activationPad = null;
			
			var to = null;
			var data = null;
			
			var responder = function(status,data,vErrors,bErrors) {
				expect(status).to.equal('accepted');
				expect(to).to.equal(email);
				done();
			};
			
			var mockEmailSender = function(config, from, ito, subjectTemplate, textTemplate, idata, next) {
				to = ito;
				data = idata;
				next(0);
			};
			
			var newReq = {
				accepts: function() {return 'text/html'; },
				body: {name: 'John Jones', email: email, color: 'blue'}
			};
			
			var dupEmailSFDb = {
				insert: function(collection, document, next) {
					if (collection == appConfig.user_email_collection) {
						return next(SFDb.ERROR.DUPLICATE_ID);
					}
					return next(SFDb.ERROR.OK);
				},
				modifyOne: function(collection, query, update, options, callback) {
					expect(update.$set.activationPad).to.match(/^aaa/);
					callback(
						SFDb.ERROR.OK,
						{
							"_id" : "fUXJMvfj",
							"color" : "red",
							"email" : email,
							"name" : "John Jones",
							"password" : "zzz",
							"activationPad": update.$set.activationPad
						}
					);
				}
			};
			
			userRoute.register.process(
				appConfig,
				efvarl,
				mockEmailSender,
				mockGenerateRandomString,
				dupEmailSFDb,
				req,
				{},
				responder
			);

		});
	});
	
});

describe('Requesting activation form',function() {
	
	var db = require('mongoskin').db(
			appConfig.database_host +
				':' +
				appConfig.database_port +
				'/' +
				'syncitserv_user_js',
			{w:1}
		),
		utils = {
			sFDb: SFDb.createInstance(db),
			validator: efvarl,
			crypto: libCrypto
		};

	var getUserDetailsForTest = function() {
		
		var r = {
			email: 'jack.'+(new Date().getTime()/1000)+'.jenkins@hisdomain.com',
			name: 'Jack Jenkins',
			color: 'red'
		};
		return r;
		
	};
	
	
	it('errors if it cannot find the record', function(done) {
		
		var requestHandler = function (status,data) {
			expect(status).to.equal('not_found');
			done();
		};
		
		var sFDb = {
			findOne: function(collection, query, options, callback) {
				expect(query._id).to.equal('invalid');
				callback(SFDb.ERROR.NO_RESULTS);
			}
		};
		
		var req = {
			params: { _id: 'invalid', activationPad: 'zzzz' },
			accepts: function() { return 'text/html'; }
		};
		
		userRoute.activate.get({}, efvarl, sFDb, req, {}, requestHandler);
	});
	
	it('responds with ok if it exists', function(done) {
		
		var requestHandler = function (status,data) {
			expect(status).to.equal('ok');
			done();
		};
		
		var sFDb = {
			findOne: function(collection, query, options, callback) {
				expect(query._id).to.equal('id');
				callback(SFDb.ERROR.OK,{});
			}
		};
		
		var req = {
			params: { _id: 'id', activationPad: 'ac' },
			accepts: function() { return 'text/html'; }
		};
		
		userRoute.activate.get({}, efvarl, sFDb, req, {}, requestHandler);
	});
});
		
describe('Processing the activation',function() {
		
	it('fail if it cannot find the Email in process',function(done) {

		var responder = function(status,data,vErr,bErr) {
			expect(
				vErr.hasOwnProperty('email,activationPad')
			).to.be(true);
			done();
		};
		
		var activationReq = {
			accepts: function() { return 'text/html'; },
			body: {
				password: 'abc123'
			},
			params: {
				_id: 'abc',
				activationPad: 'xyz'
			}
		};
		
		var sFDb = {
			modifyOne: function(collection, query, update, options, callback) {
				expect(update.$set.password).to.equal('321cba');
				expect(query.activationPad).to.equal('xyz');
				expect(query._id).to.equal('abc');
				callback(SFDb.ERROR.NO_RESULTS)
			}
		};
		
		userRoute.activate.process(
			appConfig,
			efvarl,
			mockGenerateRandomString,
			mockHasher,
			sFDb,
			activationReq,
			{},
			responder
		);
		
	});
	
	it('will hash the password and remove the activation pad on success',function(done) {
		
		var responder = function(status,data,vErr,bErr) {
			expect(Object.getOwnPropertyNames(vErr).length).to.equal(0);
			expect(data.userId).to.equal('99');
			done();
		};
		
		var activationReq = {
			accepts: function() { return 'text/html'; },
			body: {
				password: 'abc123'
			},
			params: {
				_id: '99',
				activationPad: 'uvw'
			}
		};
		
		var sFDb = {
			modifyOne: function(collection, query, update, options, callback) {
				expect(update.$set.password).to.equal('321cba');
				expect(query.activationPad).to.equal('uvw');
				expect(query._id).to.equal('99');
				callback(SFDb.ERROR.OK,{});
			},
			insert: function(collection, document, next) {
				next(SFDb.ERROR.OK);
			},

		};
			
		userRoute.activate.process(
			appConfig,
			efvarl,
			mockGenerateRandomString,
			mockHasher,
			sFDb,
			activationReq,
			{
				cookie: function(k,v) {
					if (k === 'userId') {
						expect(v).to.equal('99');
					}
					if (k === 'auth') {
						expect(v).to.match(/^aaaa/);
					}
				}
			},
			responder
		);
		
	});
});

describe('User Show...',function() {
	
	it('can be shown, even if not authenticated...',function(done) {
		
			var response = {
				_id: "Efdsa",
				color: "red",
				email: "james@speechmarks.com",
				name: "James",
				password: "pw"
			};
			
			var responder = function(status, data) {
				expect(status).to.equal('ok');
				var expected = {
					_id: response._id,
					color: response.color,
					name: response.name
				}
				expect(data).to.eql(expected);
				done();
			};
			
			var sFDb = {
				findOne: function(collection, query, options, callback) {
					callback(SFDb.ERROR.OK, response);
				}
			};
			
			userRoute.show(
				{},
				efvarl,
				userRoute.sessionCheck,
				sFDb, 
				{params:{_id: 'Efdsa'}},
				{},
				responder
			);
					
	});
	
	
	it('will fall back to unauthenticated if the session has timed out...',function(done) {
		
		var userResponse = {
			_id: "Efdsa",
			color: "red",
			email: "james@speechmarks.com",
			name: "James",
			password: "pw"
		};
		
		var responder = function(status, data) {
			expect(status).to.equal('ok');
			var expected = {
				_id: userResponse._id,
				color: userResponse.color,
				name: userResponse.name
			}
			expect(data).to.eql(expected);
			done();
		};
		
		var sFDb = {
			findOne: function(collection, query, options, callback) {
				if (collection == appConfig.user_collection) {
					callback(SFDb.ERROR.OK, userResponse);
				}
				if (collection == appConfig.auth_collection) {
					callback(SFDb.ERROR.OK, {
						"id": '_cook1e',
						"userId": "Efdsa",
						"created": new Date(new Date().getTime()-1000*60*60*24),
						"lastUsed": new Date(new Date().getTime()-1000*60*60*3),
						"life": "0C"
					});
				}
			},
			modifyOne: function(collection, query, update, options, callback) {
				callback(SFDb.ERROR.OK);
			}
		};
		
		userRoute.show(
			appConfig,
			efvarl,
			userRoute.sessionCheck,
			sFDb, 
			{
				params:{_id: 'Efdsa'},
				cookies: { auth: '_cook1e', userId: "Efdsa" }
			},
			{},
			responder
		);
					
	});
	
	it('will show more if authenticated...',function(done) {
		
		var userResponse = {
			_id: "Efdsa",
			color: "red",
			email: "james@speechmarks.com",
			name: "James",
			password: "pw"
		};
		
		var responder = function(status, data) {
			expect(status).to.equal('ok');
			var expected = {
				_id: userResponse._id,
				color: userResponse.color,
				name: userResponse.name,
				email: userResponse.email
			}
			expect(data).to.eql(expected);
			done();
		};
		
		var sFDb = {
			findOne: function(collection, query, options, callback) {
				if (collection == appConfig.user_collection) {
					callback(SFDb.ERROR.OK, userResponse);
				}
				if (collection == appConfig.auth_collection) {
					callback(SFDb.ERROR.OK, {
						"id": '_cook1e',
						"userId": "Efdsa",
						"created": new Date(new Date().getTime()-5000),
						"lastUsed": new Date(new Date().getTime()-1000),
						"life": "0C"
					});
				}
			},
			modifyOne: function(collection, query, update, options, callback) {
				callback(SFDb.ERROR.OK);
			}
		};
		
		userRoute.show(
			appConfig,
			efvarl,
			userRoute.sessionCheck,
			sFDb, 
			{
				params:{_id: 'Efdsa'},
				cookies: { auth: '_cook1e', userId: "Efdsa" }
			},
			{},
			responder
		);
					
	});
	
	it('will give a not_found when it does not exist',function(done) {
		
		var sFDb = {
			findOne: function(collection, query, options, callback) {
				callback(SFDb.ERROR.NO_RESULTS);
			}
		};
		
		userRoute.show(
			{},
			efvarl,
			userRoute.sessionCheck,
			sFDb, 
			{ params:{ _id:'nobodys id' } },
			{},
			function(status) {
				expect(status).to.eql('not_found');
				done();
			}
		);
	});
	
});

describe('Session...',function() {
		
	var activate = function(id,email,activationPad,password,next) {
		
		var responder = function(status,data,vErr,bErr) {
			next();
		};
		
		var activationReq = {
			accepts: function() { return 'text/html'; },
			body: {
				email: email,
				password: password
			},
			params: {
				_id: id,
				activationPad: activationPad
			}
		};
		
		userRoute.activate.process(activationReq, {}, responder);
	};
	
	it('will do validation',function(done) {
		
		var doneCount = 0;
		
		var userResponse = {
			_id: "Efdsa",
			color: "red",
			email: "james@speechmarks.com",
			name: "James",
			password: "drowssap"
		};
				
		var responder = function(status,data,vErr,bErr) {
			expect(status).to.equal('validation_error')
			expect(Object.getOwnPropertyNames(vErr)).to.eql(['password','life']);
			if (++doneCount == 2) { done(); }
		};
		
		var sFDb = {
			findOne: function(collection, query, options, callback) {
				callback(SFDb.ERROR.OK, userResponse);
			},
			insert: function(collection, insertData, callback) {
				callback(SFDb.ERROR.OK);
			}
		};
		
		userRoute.session.process(
			appConfig,
			mockCheckAgainstHash,
			efvarl,
			mockGenerateRandomString,
			sFDb, 
			{ body: {email: userResponse.email, password: 'wp'} },
			{},
			responder
		);
		
		responder = function(status,data,vErr,bErr) {
			expect(status).to.equal('validation_error')
			expect(Object.getOwnPropertyNames(vErr)).to.eql(['email','life']);
			if (++doneCount == 2) { done(); }
		};
		
		userRoute.session.process(
			appConfig,
			mockCheckAgainstHash,
			efvarl,
			mockGenerateRandomString,
			sFDb, 
			{ body: {password: userResponse.password } },
			{},
			responder
		);
		
	});
	
	it('will reject session with wrong password',function(done) {
		
		var doneCount = 0;
		
		var userResponse = {
			_id: "Efdsa",
			color: "red",
			email: "james@speechmarks.com",
			name: "James",
			password: "drowssap"
		};
				
		var responder = function(status,data,vErr,bErr) {
			expect(status).to.equal('unauthorized')
			expect(Object.getOwnPropertyNames(vErr)).to.eql(['email,password']);
			done();
		};
		
		var sFDb = {
			findOne: function(collection, query, options, callback) {
				callback(SFDb.ERROR.NO_RESULTS);
			},
			insert: function(collection, insertData, callback) {
				callback(SFDb.ERROR.OK);
			}
		};
		
		userRoute.session.process(
			appConfig,
			mockCheckAgainstHash,
			efvarl,
			mockGenerateRandomString,
			sFDb, 
			{ body: { 
				email: userResponse.email,
				password: 'wrongpassword',
				life: '0C'
			} },
			{},
			responder
		);
		
	});
	it('will reject session with wrong email',function(done) {
		
		var doneCount = 0;
		
		var userResponse = {
			_id: "Efdsa",
			color: "red",
			email: "james@speechmarks.com",
			name: "James",
			password: "drowssap"
		};
				
		var responder = function(status,data,vErr,bErr) {
			expect(status).to.equal('unauthorized')
			expect(Object.getOwnPropertyNames(vErr)).to.eql(['email,password']);
			done();
		};
		
		var sFDb = {
			findOne: function(collection, query, options, callback) {
				callback(SFDb.ERROR.NO_RESULTS);
			},
			insert: function(collection, insertData, callback) {
				callback(SFDb.ERROR.OK);
			}
		};
		
		userRoute.session.process(
			appConfig,
			mockCheckAgainstHash,
			efvarl,
			mockGenerateRandomString,
			sFDb, 
			{ body: { 
				email: userResponse.email + "X",
				password: userResponse.password,
				life: '0C'
			} },
			{},
			responder
		);
	
	});
	it('will allow login when both username and password are correct',function(done) {
		
		var doneCount = 0;
		
		var userResponse = {
			_id: "Efdsa",
			color: "red",
			email: "james@speechmarks.com",
			name: "James",
			password: "drowssap"
		};
				
		var responder = function(status,data,vErr,bErr) {
			expect(status).to.equal('created')
			expect(Object.getOwnPropertyNames(vErr)).to.eql([]);
			done();
		};
		
		var sFDb = {
			findOne: function(collection, query, options, callback) {
				callback(SFDb.ERROR.OK, userResponse);
			},
			insert: function(collection, insertData, callback) {
				expect(insertData._id).to.match(/^aaa/);
				expect(insertData.userId).to.eql('Efdsa');
				callback(SFDb.ERROR.OK);
			}
		};
		
		userRoute.session.process(
			appConfig,
			mockCheckAgainstHash,
			efvarl,
			mockGenerateRandomString,
			sFDb, 
			{ body: { 
				email: userResponse.email,
				password: userResponse.password.split('').reverse().join(''),
				life: '0C'
			} },
			{
				cookie: function(k, v) {
					expect(['userId','auth'].indexOf(k)).to.be.greaterThan(-1);
					if (k == 'auth') { expect(v).to.match(/^aaa/); }
					if (k == 'auth') { expect(v).to.match(/^aaa/); }
				}
			},
			responder
		);
		
	});
});
