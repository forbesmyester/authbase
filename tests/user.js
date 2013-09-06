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
}

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

