/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var user = require('./routes/user');
var http = require('http');
var path = require('path');
var renderRouter = require('./libs/renderRouter');

var emailSender = function(config, from, to, subjectTemplate, textTemplate, data, next) {
	var hogan = require("hogan.js");
	var out = [
		"FROM: " + from,
		"TO: " + to,
		"SUBJECT: " + hogan.compile(subjectTemplate).render(data),
		"BODY: " + hogan.compile(textTemplate).render(data)
	].join("\n");
	console.log(out);
	next(0)
};

var getResponseContentType = function(req) {
	var responseType = req.accepts('application/json, text/html');
	if (responseType == 'application/json') {
		return 'json';
	}
	return 'html';
};

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser('your secret here'));
app.use(express.session());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
	console.log("DEVELOPMENT MODE");
	app.use(express.errorHandler());
}

var getResponder = function(pattern, req, res) {
	
	return function(statusStr, data, validationErr, businessErr, serverErr) {
		
		var toTemplate = {
			data
		}
		
		var getTemplateRendererFor(status, viewPath) {
			return function() {
				res.status(status)
					.render(
						viewPath,
						data
					);
			}
		};
		
		var respondingFunction = renderRouter(
			{
				'html/user/register/ok': function() {
					res.render('user/re');
				},
				'////': function() {
					res.status(404).end('NOT FOUND');
				}
			},
			pattern
				.replace(':status', statusStr)
				.replace(':contentType', getResponseContentType(req))
		);
		
		respondingFunction.call(this);
		
	};
	
};

/*

user_email: { _id: email, user_id: uid }
user: { _id: uid, name: str, color: str }
user_password: { _id: uid, authorization_key: str, password: bin }

= Registration
Find email in emails():
	Not Exists:
		Create
	Continue:
		Look up UserId in Password()
			Not Exists: Create Empty
			Continue:
				Update with new Authorization Key
    

= Activation
	If no email in emails:
		Not Exists:
			Error
		Exists:
			Get UserId
			Look up UserId / Authorization in Password:
				Not Matches:
					Error
				Matches:
					Write Password
*/


var wrapControllerFunctionForResponder = function(renderPattern, controllerFunction) {
	return function(req, res, next) {
		var responder = getResponder(
			renderPattern,
			req,
			res
		);
		controllerFunction.call(this, req, res, responder)
	};
};

app.get('/', wrapControllerFunctionForResponder(
	':contentType/user/register/:status',
	function(req, res, responder) {
		responder('ok',{hi:'there'});
	}
));

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
