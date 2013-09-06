/*
Sends an activation email then responds to the User.
*/
var sendActivationEmail = function(config, emailSender, res, _id, email, name, color, activationPad, registrationEmail, responder) {
	
	var emailTemplate = registrationEmail ? 'register' : 'reactivation';

	var data = {
		_id: _id,
		name: name,
		color: color,
		email: email,
		activationPad: activationPad
	};
	
	emailSender(
		{},
		config.email[emailTemplate].from,
		email,
		config.email[emailTemplate].subject_tempate,
		config.email[emailTemplate].text_template,
		data,
		function() {
			delete data.activationPad;
			responder('accepted',data);
		}
	);
};

var validator = require('validator');

var checkingStructures = {
	name: {
		required: true,
		missingMessage: 'You must have a name',
		filters: [
			function(name) {
				return validator.sanitize(name).trim();
			}
		],
		checks: [
			function(name) {
				validator.check(
					name,
					'Your name must be at least three characters'
				).len(3);
			}
		]
	},
	email: {
		required: true,
		missingMessage: 'You must specify an email',
		filters: [
			function(name) {
				return validator.sanitize(name).trim();
			}
		],
		checks: [
			function(email) {
				validator.check(
					email,
					'Your email does not look like an email'
				).isEmail();
			}
		]
	},
	user_id: {
		required: true,
		missingMessage: 'You must specify a User Id',
		filters: [
			function(name) {
				return validator.sanitize(name).trim();
			}
		],
		checks: []
	},
	life: {
		required: true,
		missingMessage: 'You must specify the amount of time to stay logged in',
		filters: [
			function(l) {
				return validator.sanitize(l).trim();
			}
		],
		checks: [
			function(l) {
				validator.check(l,'Not a valid value')
					.isIn(["0C", "1D", "1W", "2W", "1M" ]);
			}
		]
	},
	color: {
		required: true,
		missingMessage: 'You must pick a color',
		filters: [
			function(name) {
				return validator.sanitize(name).trim();
			}
		],
		checks: [
			function(color) {
				validator.check(
					color,
					'No color selected'
				).isIn(['red','green','blue']);
			}
		]
	},
	password: {
		required: true,
		missingMessage: 'You must specify a password',
		filters: [
			function(name) {
				return validator.sanitize(name).trim();
			}
		],
		checks: [
			function(password) {
				validator.check(
					password,
					'Your password must be at least four characters'
				).len(4);
			}
		]
	},
	activationPad: {
		required: true,
		missingMessage: 'You must specify an activation pad',
		filters: [
			function(name) {
				return validator.sanitize(name).trim();
			}
		],
		checks: []
	}
};

/**
 * ## Registration
 */
module.exports.register = {};

/**
 * Registration Screen
 */
module.exports.register.get = function(config, getResponseFormat, req, res, responder) {
	if (getResponseFormat(req) != 'html') {
		return responder('not_acceptable', {}, {}, {});
	}
	return responder('ok', {}, {}, {});
};

/**
 * ### POST /user (HTML Only)
 * 
 * #### Input
 * 
 * * name: The desired Name of the User.
 * * email: The desired email of the User.
 * * color: The color which will represent the User.
 * 
 * #### Processing
 * 
 * Registration occurs with a Name, Email and Color and if any of these fail validation it will return with a `user/register/html/post/validation_error`
 * 
 * If the no User with the Email exists and on the system, it will be created and the server will respond with `user/register/html/post/accepted`. That email will include the URL /session/[User.id]/[User.activationPad] allowing the User to Activate the account.
 * 
 * If the a User with that email address already exists in the system a new Activation Pad will be created for that User and an email will be allowing that user to reset their password, the old password will still stay valid. The HTTP response will be exactly the same as if the User did not exist.
 */
module.exports.register.process = function(config, efvarl, emailSender, generateRandomString, sFDb, req, res, responder) {
	
	var validated = {},
		mergeData = {};
	
	validated = efvarl(
		{
			name: checkingStructures.name,
			email: checkingStructures.email,
			color: checkingStructures.color
		},
		req.body
	);
	
	if (validated.hasErrors) {
		return responder('validation_error',{},validated.errors,{});
	}

	var mergeDataRetrieved = function(_id, activationPad) {
		
		var attemptsLeft = 10;

		var errorDuplicateUserId = function() {
			if (attemptsLeft-- > 0) {
				return generateRandomString(config.activation_pad_length, function(err,newId) {
					if (err) { throw err; }
					mergeDataRetrieved(newId,activationPad);
				});
			}
			throw new Error(
				'MaxInsertionAttemptsHit: ' +
				require('util').format(
					'Attempting to insert user %j resulted in too many insertion attempts',
					validated.data
				)
			);
		};
		
		var setActivationPad = function(newRegistration, newEmail, activationPad) {
			
			var send = function() {
				sendActivationEmail(
					config,
					emailSender,
					res,
					_id,
					validated.data.email,
					validated.data.name,
					validated.data.color,
					activationPad,
					newEmail,
					responder
				);
			};
			
			if (newRegistration) {
				return sFDb.insert(
					config.user_password_collection,
					{_id: _id, activationPad: activationPad},
					function(err) {
						if (err) {
							throw "aUNKNOWN ERROR! " + JSON.stringify(err);
						}
						send();
					}
				);
			}
			sFDb.modifyOne(
				config.user_password_collection,
				{_id: _id},
				{$set: {activationPad: activationPad} },
				{},
				function(err, result) {
					if (err == sFDb.ERROR_CODES.NO_RESULTS) {
						//
						return setActivationPad(true, false, activationPad);
					}
					if (err) {
						throw new Error('ErrorUpdatingActivationPad: '+err);
					}
					if (result === null) {
						var msg = "NonOneUpdateUpdatingUserActivationPad: \n"+
							"email: "+validated.data.email+"\n"+
							"result count: "+result;
						throw new Error(msg);
					}
					send();
				}
			);
		};
		
		sFDb.insert(
			config.user_collection,
			{ 
				_id: _id,
				createdAt: new Date(),
				name: validated.data.name,
				color: validated.data.color
			},
			function(err) {
				if (err == sFDb.ERROR_CODES.DUPLICATE_ID) {
					return errorDuplicateUserId();
				}
				if (err) {
					throw "bUNKNOWN ERROR! " + JSON.stringify(err);
				}
				sFDb.insert(
					config.user_email_collection,
					{ _id: validated.data.email, userId: _id },
					function(err) {
						var newUser = true;
						if (err == sFDb.ERROR_CODES.DUPLICATE_ID) {
							// TODO: Write script to clean up old user_collection
							// records that have been left.
							newUser = false;
							err = 0;
						}
						if (err) {
							throw "UNKNOWN ERROR! " + JSON.stringify(err);
						}
						return generateRandomString(
							config.activation_pad_length,
							function(err, result) {
								if (err) {
									throw "UNKNOWN ERROR! " + JSON.stringify(err);
								}
								setActivationPad(newUser, newUser, result);
							}
						);
					}
				);
			}
		);
	};

	(function() {
		var collected = {
		};
		
		var sendIfReady = function() {
			if (
				collected.hasOwnProperty('_id') && 
				collected.hasOwnProperty('activationPad')
			) {
				mergeDataRetrieved(collected._id, collected.activationPad);
			}
		};
		
		generateRandomString(config.activation_pad_length, function(err,activationPad) {
			collected.activationPad = activationPad;
			sendIfReady();
		});
		generateRandomString(config.id_length, function(err,_id) {
			collected._id = _id;
			sendIfReady();
		});
	}());
};
