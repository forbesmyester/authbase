/* globals describe, it */

var userRoute = require('../routes/user.js'),
	SFDb = require('../libs/SFDb.js'),
	expect = require('expect.js'),
	//libCrypto = require('../libs/utils.crypto.js'),
	sinon = require('sinon'),
	efvarl = require('../libs/efvarl.js'),
	//ResponseSelector = require('../libs/ResponseRouter'),
	appConfig = require('../config');
	
var mockGenerateRandomString = function(l, next) {
	var r = '';
	while (r.length < l) {
		r = r + 'a';
	}
	return next(0, r);
};

var mockHasher = function(str, next) {
	next(0, str.split('').reverse().join(''));
};

var mockCheckAgainstHash = function(inputted, hashedPassword, next) {
	if (inputted.split('').reverse().join('') == hashedPassword) {
		return next(0, true);
	}
	return next(0, false);
};

describe('user.register is saying',function() {

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
				body: {name: 'Jack Jenkins', email: 'jack.jenkins.hisdomain.com'}
			},
			email_b: { //No Email
				accepts: function() {return 'text/html'; },
				body: {name: 'Jack Jenkins', email: ''} },
			name_a:{ // No Name
				accepts: function() {return 'text/html'; },
				body: {name: '', email: 'jack.jenkins@hisdomain.com'}
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
			body: {email: 'jackjenkineszzz@abc.com'}
		};
	
		it('will feed back error information and your own data', function(done) {
			var responseFunc = function(status,data,vErrors,bErrors) {
				expect(bErrors).to.eql({});
				expect(vErrors.hasOwnProperty('name')).to.equal(true);
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
				expect(bErrors).to.eql({});
				expect(vErrors).to.eql({});
				expect(to).to.equal(email);
				expect(data._id).to.match(/^aa/);
				expect(data.hasOwnProperty('activationPad')).to.equal(false);
				done();
			};
			
			var sFDb = { inserts: [] };
			// sFDb.successfulModifyOne = function(collection, query, update, options, callback)
			sFDb.insert = function(collection, document, next) {
				sFDb.inserts.push({
					document: document,
					collection: collection
				});
				next(SFDb.ERROR.OK);
			};
			sFDb.ERROR_CODES = SFDb.ERROR;
			
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
			'the activationPad and send an activationPad email (email record existing)',function(done) {
				
			var to = null;
			var data = null;
			
			var responder = function(status,data,vErrors,bErrors) {
				expect(vErrors).to.eql({});
				expect(bErrors).to.eql({});
				expect(status).to.equal('accepted');
				expect(data._id).to.equal('J123');
				expect(to).to.equal(email);
				done();
			};
			
			var mockEmailSender = function(config, from, ito, subjectTemplate, textTemplate, idata, next) {
				to = ito;
				data = idata;
				next(0);
			};
			
			var dupEmailSFDb = {
				insert: function(collection, document, next) {
					if (collection == appConfig.user_email_collection) {
						return next(SFDb.ERROR.DUPLICATE_ID);
					}
					return next(SFDb.ERROR.OK);
				},
				findOne: function(collection, query, options, callback) {
					return callback(SFDb.ERROR.OK, {email: email, userId: 'J123'} );
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
				},
				ERROR_CODES: SFDb.ERROR
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
	
	it('errors if it cannot find the record', function(done) {
		
		var requestHandler = function (status) {
			expect(status).to.equal('not_found');
			done();
		};
		
		var sFDb = {
			ERROR_CODES: SFDb.ERROR,
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
		
		var requestHandler = function (status) {
			expect(status).to.equal('ok');
			done();
		};
		
		var sFDb = {
			ERROR_CODES: SFDb.ERROR,
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
			expect(data).to.eql({});
			expect(
				vErr.hasOwnProperty('email,activationPad')
			).to.be(true);
			expect(bErr).to.eql({});
			done();
		};
		
		var activationReq = {
			accepts: function() { return 'text/html'; },
			body: {
				password: 'abc123',
				email: 'jack@twentysomething.com'
			},
			params: {
				_id: 'abc',
				activationPad: 'xyz'
			}
		};
		
		var sFDb = {
			ERROR_CODES: SFDb.ERROR,
			modifyOne: function(collection, query, update, options, callback) {
				expect(update.$set.password).to.equal('321cba');
				expect(query.activationPad).to.equal('xyz');
				expect(query._id).to.equal('abc');
				callback(SFDb.ERROR.NO_RESULTS);
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
			expect(bErr).to.eql({});
			expect(Object.getOwnPropertyNames(vErr).length).to.equal(0);
			expect(data.userId).to.equal('99');
			done();
		};
		
		var activationReq = {
			accepts: function() { return 'text/html'; },
			body: {
				password: 'abc123',
				email: 'jack@twentyfour.com'
			},
			params: {
				_id: '99',
				activationPad: 'uvw'
			}
		};
		
		var sFDb = {
			ERROR_CODES: SFDb.ERROR,
			modifyOne: function(collection, query, update, options, callback) {
				expect(update.$set.password).to.equal('321cba');
				expect(update.$unset).to.have.property('activationPad');
				expect(query.activationPad).to.equal('uvw');
				expect(query.email).to.equal('jack@twentyfour.com');
				expect(query._id).to.equal('99');
				callback(SFDb.ERROR.OK,{});
			},
			insert: function(collection, document, next) {
				next(SFDb.ERROR.OK);
			}

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

describe('can authenticate using mozilla persona', function() {
	
	it('will create when they don\'t exist, even if dup id generated (once)', function(done) {
		
		var duplicated = false;
		
		var sFDb = {
			ERROR_CODES: SFDb.ERROR,
			findOne: function(collection, query, options, callback) {
				expect(query._id).to.equal('i.do.not@exist.com');
				callback(SFDb.ERROR.NO_RESULTS);
			},
			insert: function(collection, document, callback) {
				if (duplicated) { 
					return callback(
						SFDb.ERROR.OK, {
							_id: 'i.do.not@exist.com',
							userId: 'metoo'
						}
					);
				}
				duplicated = true;
				callback(SFDb.ERROR.DUPLICATE_ID);
			}
		};
		
		userRoute.passport.findByEmail(
			appConfig,
			mockGenerateRandomString,
			sFDb,
			'i.do.not@exist.com',
			function(err, user) {
				expect(duplicated).to.equal(true);
				expect(err).to.equal(null);
				expect(user.email).to.equal('i.do.not@exist.com');
				expect(user._id).to.equal('aaaaaaaa');
				done();
			}
		);
		
	});
	
	it('will respond with users if found', function(done) {
		
		var sFDb = {
			ERROR_CODES: SFDb.ERROR,
			findOne: function(collection, query, options, callback) {
				expect(query._id).to.equal('i.do@exist.com');
				callback(
					SFDb.ERROR.OK,
					{
						_id: 'i.do@exist.com',
						userId: 'yesido'
					}
				);
			}
		};
		
		userRoute.passport.findByEmail(
			appConfig,
			mockGenerateRandomString,
			sFDb,
			'i.do@exist.com',
			function(err, user) {
				expect(err).to.equal(null);
				expect(user).to.eql({
					email: 'i.do@exist.com',
					_id: 'yesido',
					method: 'mozilla'
				});
				done();
			}
		);
	});
	
});

describe('can authenticate using passport interface', function() {
		
	it('will return a proper error message when email is wrong',function(done) {
		
		var sFDb = {
			ERROR_CODES: SFDb.ERROR,
			findOne: function(collection, query, options, callback) {
				expect(query._id).to.equal('a');
				callback(SFDb.ERROR.NO_RESULTS);
			}
		};
		
		userRoute.passport.userPasswordCheck(
			appConfig,
			mockCheckAgainstHash,
			sFDb,
			'a',
			'b',
			function(err, user, messageObj) {
				expect(err).to.equal(null);
				expect(user).to.equal(false);
				expect(messageObj).to.have.property('message');
				expect(
					messageObj.message
				).to.equal(
					appConfig.messages.wrong_username_password
				);
				done();
			}
		);
		
	});
	
	it('will return a proper error message when password is not found',function(done) {
		
		var sFDb = {
			ERROR_CODES: SFDb.ERROR,
			findOne: function(collection, query, options, callback) {
				if (collection == appConfig.user_email_collection) {
					expect(query._id).to.equal('abc@abc.com');
					return callback(
						SFDb.ERROR.OK,
						{ _id: 'abc@abc.com', userId: 'abc' }
					);
				}
				expect(query._id).to.equal('abc');
				callback(SFDb.ERROR.NO_RESULTS);
			}
		};
		
		userRoute.passport.userPasswordCheck(
			appConfig,
			mockCheckAgainstHash,
			sFDb,
			'abc@abc.com',
			'b',
			function(err, user, messageObj) {
				expect(err).to.equal(null);
				expect(user).to.equal(false);
				expect(messageObj).to.have.property('message');
				expect(
					messageObj.message
				).to.equal(
					appConfig.messages.wrong_username_password
				);
				done();
			}
		);
		
	});
	
	it('will return a proper error message when password is not correct',function(done) {
		
		var sFDb = {
			ERROR_CODES: SFDb.ERROR,
			findOne: function(collection, query, options, callback) {
				if (collection == appConfig.user_email_collection) {
					expect(query._id).to.equal('abc@abc.com');
					return callback(
						SFDb.ERROR.OK,
						{ _id: 'abc@abc.com', userId: 'abc' }
					);
				}
				expect(query._id).to.equal('abc');
				return callback(
					SFDb.ERROR.OK,
					{ _id: 'abc@abc.com', password: 'xxx' }
				);
			}
		};
		
		userRoute.passport.userPasswordCheck(
			appConfig,
			mockCheckAgainstHash,
			sFDb,
			'abc@abc.com',
			'xyz',
			function(err, user, messageObj) {
				expect(err).to.equal(null);
				expect(user).to.equal(false);
				expect(messageObj).to.have.property('message');
				expect(
					messageObj.message
				).to.equal(
					appConfig.messages.wrong_username_password
				);
				done();
			}
		);
		
	});
	
	it('will work if username / password are correct',function(done) {
		
		var sFDb = {
			ERROR_CODES: SFDb.ERROR,
			findOne: function(collection, query, options, callback) {
				if (collection == appConfig.user_email_collection) {
					expect(query._id).to.equal('abc@abc.com');
					return callback(
						SFDb.ERROR.OK,
						{ _id: 'abc@abc.com', userId: 'abc' }
					);
				}
				expect(query._id).to.equal('abc');
				return callback(
					SFDb.ERROR.OK,
					{ _id: 'abc@abc.com', password: 'zyx' }
				);
			}
		};
		
		userRoute.passport.userPasswordCheck(
			appConfig,
			mockCheckAgainstHash,
			sFDb,
			'abc@abc.com',
			'xyz',
			function(err, user, messageObj) {
				expect(err).to.equal(null);
				expect(user).to.eql({
					_id: 'abc',
					email: 'abc@abc.com',
					method: 'password'
				});
				expect(messageObj).to.eql(undefined);
				done();
			}
		);
		
	});
	
	it('will will pass on errors when occuring during user lookup',function(done) {
			
		var sFDb = {
			ERROR_CODES: SFDb.ERROR,
			findOne: function(collection, query, options, callback) {
				expect(query._id).to.equal('a');
				callback(SFDb.ERROR.UNIDENTIFIED);
			}
		};
		
		userRoute.passport.userPasswordCheck(
			appConfig,
			mockCheckAgainstHash,
			sFDb,
			'a',
			'b',
			function(err, user, messageObj) {
				expect(err).to.equal(SFDb.ERROR.UNIDENTIFIED);
				done();
			}
		);
		
	});
	
	it('will will pass on errors when occuring during password lookup',function(done) {
		var sFDb = {
			ERROR_CODES: SFDb.ERROR,
			findOne: function(collection, query, options, callback) {
				if (collection == appConfig.user_email_collection) {
					expect(query._id).to.equal('abc@abc.com');
					return callback(
						SFDb.ERROR.OK,
						{ _id: 'abc@abc.com', userId: 'abc' }
					);
				}
				expect(query._id).to.equal('abc');
				callback(SFDb.ERROR.UNIDENTIFIED);
			}
		};
		
		userRoute.passport.userPasswordCheck(
			appConfig,
			mockCheckAgainstHash,
			sFDb,
			'abc@abc.com',
			'b',
			function(err, user, messageObj) {
				expect(err).to.equal(SFDb.ERROR.UNIDENTIFIED);
				done();
			}
		);
	});
});
