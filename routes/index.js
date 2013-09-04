/*
 * GET home page.
 */

exports.index = function(config, sessionCheck, sFDb, req, res, responder){
	return responder('ok', { loggedIn: loggedIn }, {}, {});
};
