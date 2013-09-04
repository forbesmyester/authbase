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