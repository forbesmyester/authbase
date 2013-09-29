/*
Sends an activation email then responds to the User.
*/
var sendActivationEmail = function(config, emailSender, res, _id, email, name, activationPad, registrationEmail, responder) {
	
	var emailTemplate = registrationEmail ? 'register' : 'reactivation';

	var data = {
		_id: _id,
		name: name,
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
			responder('accepted', data, {}, {});
		}
	);
};

var validator = require('validator');

var checkingStructures = {
	name: {
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
		missingMessage: 'You must specify a User Id',
		filters: [
			function(name) {
				return validator.sanitize(name).trim();
			}
		],
		checks: []
	},
	password: {
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
 * ## buildCheckingStructure
 *
 * Convenience function for preparing data for efvarl.
 *
 * Takes `rulesAndWhetherRequired` which should be an array and pulls out structures and whether they should be required or not.
 *
 * * **@param {Array} `rulesAndWhetherRequired`** An Array of Object which should
 *		contain keys rule and required.
 *
 * ### Example
 * 
 * ```
 * var checkingStructure = buildCheckingStructure([
 *   { rule: user_id, required: true },
 *   { rule: activationPad, required: true }
 * ]);
 * ```
 */
var buildCheckingStructure = function(rulesAndWhetherRequired) {
	
	var i, l,
		r = {},
		key;
	
	for (i=0, l=rulesAndWhetherRequired.length; i<l; i++) {
		
		if (
			!rulesAndWhetherRequired[i].hasOwnProperty('rule') ||
			!rulesAndWhetherRequired[i].hasOwnProperty('required')
		) {
			throw "buildCheckingStructure requires every object to have a rule and required...";
		}
		
		if (!checkingStructures.hasOwnProperty(rulesAndWhetherRequired[i].rule)) {
			throw "buildCheckingStructure was asked for rule " + rulesAndWhetherRequired[i].rule + " but that could not be found in checkingStructures";
		}
		key = rulesAndWhetherRequired[i].hasOwnProperty('mapped') ?
			rulesAndWhetherRequired[i].mapped :
			rulesAndWhetherRequired[i].rule;
		r[key] = require('node.extend').call(
			{},
			checkingStructures[rulesAndWhetherRequired[i].rule],
			{ required: rulesAndWhetherRequired[i].required }
		);
	}
	
	return r;
	
}

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
 * 
 * #### Processing
 * 
 * Registration occurs with a Name and Email and if any of these fail validation it will return with a `user/register/html/post/validation_error`
 * 
 * If the no User with the Email exists and on the system, it will be created and the server will respond with `user/register/html/post/accepted`. That email will include the URL /session/[User.id]/[User.activationPad] allowing the User to Activate the account.
 * 
 * If the a User with that email address already exists in the system a new Activation Pad will be created for that User and an email will be allowing that user to reset their password, the old password will still stay valid. The HTTP response will be exactly the same as if the User did not exist.
 */
module.exports.register.process = function(config, efvarl, emailSender, generateRandomString, sFDb, req, res, responder) {
	
	var validated = {},
		mergeData = {};
	
	validated = efvarl(
		buildCheckingStructure(
			[
				{ rule: 'name', required: 'true' },
				{ rule: 'email', required: 'true' }
			]
		),
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
		
		var setActivationPad = function(newRegistration, newEmail, userId, activationPad) {
			
			var send = function() {
				sendActivationEmail(
					config,
					emailSender,
					res,
					userId,
					validated.data.email,
					validated.data.name,
					activationPad,
					newEmail,
					responder
				);
			};
			
			if (newRegistration) {
				return sFDb.insert(
					config.user_password_collection,
					{
						_id: userId,
						activationPad: activationPad,
						email: validated.data.email
					},
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
				{_id: userId},
				{$set: {activationPad: activationPad, email: validated.data.email} },
				{},
				function(err, result) {
					if (err == sFDb.ERROR_CODES.NO_RESULTS) {
						//
						return setActivationPad(
							true,
							false,
							userId,
							activationPad
						);
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
		
		var duplicateEmail = function(oldId) {
			
			// TODO: Write script to clean up old user_collection
			// records that have been left.
			
			sFDb.findOne(
				config.user_email_collection,
				{ _id: validated.data.email },
				{},
				function(err, userRec) {
					if (err) {
						throw "zUNKNOWN ERROR! " + JSON.stringify(err);
					}
					generateRandomString(
						config.activation_pad_length,
						function(err, activationPad) {
							if (err) {
								throw "UNKNOWN ERROR! " + JSON.stringify(err);
							}
							setActivationPad(
								false,
								true,
								userRec.userId,
								activationPad
							);
						}
					);
				}
			);
			
			
			
		};
		
		sFDb.insert(
			config.user_collection,
			{ 
				_id: _id,
				createdAt: new Date(),
				name: validated.data.name
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
							return duplicateEmail(_id);
						}
						return generateRandomString(
							config.activation_pad_length,
							function(err, result) {
								if (err) {
									throw "UNKNOWN ERROR! " + JSON.stringify(err);
								}
								setActivationPad(true, true, _id, result);
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

module.exports.activate = {};

/**
 * If the Id/ActivationPad combination is found a `/user/activate/html/get/ok` response will be sent. This will require the website user to input the Email of the User which is being activated, the ActivationPad and a Password.
 * 
 * If the Id or ActivationPad does not pass validation or is not valid either a `/user/activate/html/get/validation_error` or `/user/activate/html/get/not_found` will be sent respectively.
 */
module.exports.activate.get = function(config, efvarl, sFDb, req, res, responder) {
	
	var validated = efvarl(
		buildCheckingStructure(
			[
				{ rule: 'user_id', mapped: '_id', required: 'true' },
				{ rule: 'activationPad', required: 'true' }
			]
		),
		req.params
	);
	
	if (validated.hasErrors) {
		return responder('validation_error',{},validated.errors);
	}
	
	var qry = {
		_id: validated.data._id,
		activationPad: validated.data.activationPad
	};

	sFDb.findOne(
		config.user_password_collection,
		qry,
		{},
		function(err) {
			
			if (err == sFDb.ERROR_CODES.NO_RESULTS) {
				return responder(
					'not_found',
					{},
					{ 'activationPad': 'Could not find Activation Pad / Id' }
				);
			}
			
			if (err != sFDb.ERROR_CODES.OK) { throw err; }
			
			return responder('ok',{});

		}
	);
	  
};


/**
 * ### PATCH to /user/[id]/activate/[activationPad] (HTML Only)
 * 
 * #### Input
 * 
 * * id: The Id of the User.
 * * activationPad: The ActivationPad of the User.
 * * password: The password you wish to give the User.
 * * email: Must match the email of the User
 * 
 * #### Processing
 * 
 * If the input is invalid a `/user/activate/html/patch/validation_error` response will be sent.
 * 
 * If the id/activationPad/email combination does not identify a user a `/user/activate/html/patch/not_found` will be sent.
 *
 * If the id/activationPad is valid then User.password will be set to the supplied password and the `/user/activate/html/patch/accepted` response will be sent.
 */
module.exports.activate.process = function(config, efvarl, generateRandomString, hasher, sFDb, req, res, responder) {
	
	var validated = efvarl(
		buildCheckingStructure(
			[
				{ rule: 'user_id', mapped: '_id', required: 'true' },
				{ rule: 'activationPad', required: 'true' },
				{ rule: 'email', required: 'true' },
				{ rule: 'password', required: 'true' }
			]
		),
		require('node.extend').call(
			this,
			true,
			{},
			req.body,
			req.params
		)
	);
	
	if (validated.hasErrors) {
		return responder(
			'validation_error',
			{},
			validated.errors
		);
	}

	var qry = {
		_id: validated.data._id,
		email: validated.data.email,
		activationPad: validated.data.activationPad
	};
	
	hasher(validated.data.password,function(err,hashedPassword) {
		if (err) { throw err; }
		
		sFDb.modifyOne(
			config.user_password_collection,
			qry,
			{ 
				$set:{password: hashedPassword},
				$unset:{activationPad: 1, email: 1}
			},
			{},
			function(err) {
				
				if (err === sFDb.ERROR_CODES.NO_RESULTS) {
					return responder(
						'not_found',
						{},
						{ 'email,activationPad': 'The email/activation pad combination supplied is invalid' },
						{}
					);
				}
				
				if (err) { throw err; }
				
				return responder(
					'accepted',
					{userId: validated.data._id},
					{},
					{}
				);
				
			}
		);
	});
	
};

module.exports.passport = {};

module.exports.passport.sFDbErrorTranslate = function(config, err, sFDb, next) {
	if (err == sFDb.ERROR_CODES.NO_RESULTS) {
		return next(
			null,
			false,
			{ message: config.messages.wrong_username_password }
		);
	}
	if (err) next(err);
	return err;
};

module.exports.passport._mergeWithDbUserRecord = function(config, sFDb, userId, mergeWith, next) {
	sFDb.findOne(
		config.user_collection,
		{ _id: userId },
		{},
		function(err, result) {
			if (err !== sFDb.ERROR_CODES.OK) {
				return next(err);
				//"routes/user:passport._mergeWithDbUserRecord - Error " + err + " looking up User record");
			}
			var r = {};
			next(
				null,
				require('node.extend').call({}, result, mergeWith)
			);
		}
	);
	
};

/**
 * NOT a route, used by Passport for mozilla persona
 */
module.exports.passport._findBySecondary = function(config, generateRandomString, sFDb, authMethod, secondaryCollection, secondaryKey, secondaryValue, userData, done) {
	
	var userCreateAttemptsLeft = 10;
	
	function createUser() {
		
		if (--userCreateAttemptsLeft < 0) {
			done('Too many id generation attempts', false);
		}
		
		generateRandomString(config.id_length, function(err, generatedUserId) {
			userData._id = generatedUserId;
			userData.createdAt = new Date();
			sFDb.insert(
				config.user_collection,
				userData,
				function(err, result) {
					if (err == sFDb.ERROR_CODES.DUPLICATE_ID) {
						return createUser();
					}
					sFDb.insert(
						secondaryCollection,
						{ _id: secondaryValue, userId: generatedUserId},
						function(err, result) {
							if (err) {
								return module.exports.passport.sFDbErrorTranslate(
									config,
									err,
									sFDb,
									done
								);
							}
							var r = {
								_id: generatedUserId,
								method: authMethod
							};
							r[secondaryKey] = secondaryValue;
							return module.exports.passport._mergeWithDbUserRecord(
								config,
								sFDb,
								generatedUserId,
								r,
								done
							);
						}
					);
				}
			);
		});

	};
	
	sFDb.findOne(
		secondaryCollection,
		{ _id: secondaryValue },
		{},
		function(err, result) {
			if (err == sFDb.ERROR_CODES.NO_RESULTS) {
				return createUser();
			}
			if (err) {
				return module.exports.passport.sFDbErrorTranslate(
					config,
					err,
					sFDb,
					done
				);
			}
			var r = {
				_id: result.userId,
				method: authMethod
			};
			r[secondaryKey] = secondaryValue;
			return module.exports.passport._mergeWithDbUserRecord(
				config,
				sFDb,
				result.userId,
				r,
				done
			);
		}
	);
};

module.exports.passport.findByMozillaEmail = function(config, generateRandomString, sFDb, email, done) {
	return module.exports.passport._findBySecondary(
		config,
		generateRandomString,
		sFDb,
		'mozilla',
		config.user_email_collection,
		'email',
		email,
		{},
		done
	);
};

module.exports.passport.findByFacebook = function(config, generateRandomString, sFDb, accessToken, refreshToken, profile, done) {
	var mergeData = {
		_profile: profile
	};
	if (profile.hasOwnProperty('displayName')) {
		mergeData.name = profile.displayName;
	}
	return module.exports.passport._findBySecondary(
		config,
		generateRandomString,
		sFDb,
		'facebook',
		config.user_facebook_collection,
		'facebookId',
		profile.id,
		mergeData,
		done
	);
}

/**
 * NOT a route, used by Passport for username / password authentication within a route.
 */
module.exports.passport.userPasswordCheck = function(config, checkAgainstHash, sFDb, email, password, done) {
	
	var userId = null;
	
	sFDb.findOne(
		config.user_email_collection,
		{ _id: email },
		{},
		function(err, result) {
			if (err) {
				return module.exports.passport.sFDbErrorTranslate(
					config,
					err,
					sFDb,
					done
				);
			}
			userId = result.userId;
			sFDb.findOne(
				config.user_password_collection,
				{ _id: userId },
				{},
				function(err, result) {
					if (err) { 
						return module.exports.passport.sFDbErrorTranslate(
							config,
							err,
							sFDb,
							done
						);
					}
					checkAgainstHash(
						password,
						result.password,
						function(err, matches) {
							if (err) return done(err);
							if (!matches) {
								return done(null, false, { message: config.messages.wrong_username_password } );
							}
							return module.exports.passport._mergeWithDbUserRecord(
								config,
								sFDb,
								userId,
								{
									_id: userId,
									email: email,
									method: 'password'
								},
								done
							)
							
						}
					);
				}
			);
		}
	);
	
};

