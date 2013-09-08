/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var user = require('./routes/user');
var http = require('http');
var path = require('path');
var flash = require('connect-flash');
var curryDi = require('curry-di');
var renderRouter = require('./libs/renderRouter');
var passport = require('passport'),
	LocalStrategy = require('passport-local').Strategy,
	PersonaStrategy = require('passport-persona').Strategy;
var appConfig = require('./config');

var emailSender = function(config, from, to, subjectTemplate, textTemplate, data, next) {
	var hogan = require("hogan.js");
	var out = [
		"FROM: " + from,
		"TO: " + to,
		"SUBJECT: " + hogan.compile(subjectTemplate).render(data),
		"BODY: " + hogan.compile(textTemplate).render(data)
	].join("\n");
	console.log(out);
	next(0);
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
app.use(express.cookieParser(appConfig.cookie.secret));
app.use(express.session());
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);

app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
	console.log("DEVELOPMENT MODE");
	app.use(express.errorHandler());
}

var dependencies = {
	config: appConfig,
	efvarl: require('./libs/efvarl'),
	sFDb: 
		require('./libs/SFDb').createInstance(
			require('mongoskin').db(
				appConfig.database_host +
					':' +
					appConfig.database_port +
					'/' +
					appConfig.database_name,
				{w:true}
			)
		),
	emailSender: emailSender,
	hasher: require('./libs/utils.crypto').hasher,
	generateRandomString: require('./libs/utils.crypto').generateRandomString,
	checkAgainstHash: require('./libs/utils.crypto').checkAgainstHash
};

passport.use(new LocalStrategy(
	{ usernameField: 'email' },
	curryDi(dependencies, user.passport.userPasswordCheck)
));

passport.use(new PersonaStrategy({
		audience: 'http://' + appConfig.cookie.domain + ":3000"
	},
	curryDi(dependencies, user.passport.findByEmail)
));

passport.serializeUser(function(user, done) {
	console.log("SER: ", user);
	done(null, JSON.stringify(user));
});

passport.deserializeUser(function(user, done) {
	console.log("DESER: ", user);
	done( null, JSON.parse(user) );
});

var getResponder = function(pattern, req, res) {
	
	return function(statusStr, data, validationErr, businessErr, serverErr) {
		
		function getInputForTemplate() {
			var r = {},
				i,
				k;
			var inputs = [req.params, req.body, req.query];
			for (i=0; i<inputs.length; i++) {
				for (k in inputs[i]) {
					if (inputs[i].hasOwnProperty(k)) {
						r[k] = inputs[i][k];
					}
				}
			}
			return r;
		}
		
		function getDataAllDataForTemplate() {
			return {
				input: getInputForTemplate(),
				user: req.user,
				data: data,
				validation: validationErr,
				business: businessErr,
				server: serverErr
			};
		}
		
		function getTemplateRendererFor(viewPath) {
			var pathSplit = viewPath.split('/');
			pathSplit.shift();
			pathSplit.pop();
			return pathSplit.join('/');
		}
		
		function statusWordFromViewPath(viewPath) {
			return viewPath.split('/').pop();
		}
		
		function statusCodeFromStatusWord(statusWord) {
			if (statusWord == 'ok') { return 200; }
			if (statusWord == 'accepted') { return 202; }
			if (statusWord == 'created') { return 201; }
			if (statusWord == 'no_content') { return 204; }
			return 500;
		}
		
		function changeRenderRouterPathToStatusAndTemplate(renderRouterPath) {
			return function() {
				
				console.log(" Rendering: " +
					getTemplateRendererFor(renderRouterPath) +
					" with HTTP status " +
					statusCodeFromStatusWord(
						statusWordFromViewPath(renderRouterPath)
					) +
					" and data " + 
					JSON.stringify(getDataAllDataForTemplate())
				);
				
				res.status(
					statusCodeFromStatusWord(
						statusWordFromViewPath(renderRouterPath))
					)
					.render(
						getTemplateRendererFor(renderRouterPath),
						getDataAllDataForTemplate()
					);
			};
		}
		
		var renderRouterPath = pattern
				.replace(':status', statusStr)
				.replace(':contentType', getResponseContentType(req));
		
		var respondingFunction = renderRouter(
			{
				'html/user/register/accepted':
					function() {
						res.redirect(
							statusCodeFromStatusWord(statusStr),
							'/user/pending-activation'
						);
					},
				'html/user/activate/accepted':
					function() {
						res.redirect(
							statusCodeFromStatusWord(statusStr),
							appConfig.cookie.loginSuccessUrl
						);
					},
				'html/user//validation_error':
					changeRenderRouterPathToStatusAndTemplate(
						renderRouterPath.replace(/validation_error$/,'ok')
					),
				'html/user//not_found':
					changeRenderRouterPathToStatusAndTemplate(
						renderRouterPath.replace(/not_found$/,'ok')
					),
				'html/user//ok':
					changeRenderRouterPathToStatusAndTemplate(renderRouterPath),
				'html/index/ok':
					changeRenderRouterPathToStatusAndTemplate(renderRouterPath),
				'json/user/browserid/created':
					function() {
						res.send(
							statusCodeFromStatusWord(statusStr),
							{}
						);
					},                 
				'json/user/session/no_content':
					function() {
						res.send(
							statusCodeFromStatusWord(statusStr),
							{}
						);
					},
				'html/user/session/no_content':
					function() {
						res.redirect(
							statusCodeFromStatusWord(statusStr),
							appConfig.cookie.logoutSuccessUrl
						);
					},
				'///': function() {
					res.status(404).end(renderRouterPath + ' NOT FOUND');
				},
				'//': function() {
					res.status(404).end(renderRouterPath + ' NOT FOUND');
				}
			},
			renderRouterPath
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
		controllerFunction.call(this, req, res, responder);
	};
};

app.get('/', wrapControllerFunctionForResponder(
	':contentType/index/:status',
	function(req, res, responder) {
		responder('ok');
	}
));

app.get('/user/register', wrapControllerFunctionForResponder(
	':contentType/user/register/:status',
	function(req, res, responder) {
		responder('ok');
	}
));

app.get('/user/:_id/activate/:activationPad', wrapControllerFunctionForResponder(
	':contentType/user/activate/:status',
	curryDi(dependencies, user.activate.get)
));

app.patch('/user/:_id/activate/:activationPad', wrapControllerFunctionForResponder(
	':contentType/user/activate/:status',
	curryDi(dependencies, user.activate.process)
));

app.get('/user/pending-activation', wrapControllerFunctionForResponder(
	':contentType/user/pending-activation/:status',
	function(req, res, responder) {
		responder('ok');
	}
));

app.post('/user/register', wrapControllerFunctionForResponder(
	':contentType/user/register/:status',
	curryDi(dependencies, user.register.process)
));

app.get('/user/session', wrapControllerFunctionForResponder(
	':contentType/user/session/:status',
	function(req, res, responder) {
		responder('ok', {}, req.flash());
	}
));

app.post('/user/session',
	passport.authenticate(
		'local',
		{
			successRedirect: appConfig.cookie.loginSuccessUrl,
			failureRedirect: appConfig.cookie.loginFailUrl,
			failureFlash: true
		}
	)
);

app.post('/user/browserid', 
	passport.authenticate('persona', { failureRedirect: '/user/session' }),
	wrapControllerFunctionForResponder(
		':contentType/user/browserid/:status',
		function(req, res, responder) {
			responder('created', {}, {});
		}
	)
);

app.delete('/user/session',wrapControllerFunctionForResponder(
	':contentType/user/session/:status',
	function(req, res, responder) {
		req.logout();
		responder('no_content', {}, {});
	}
));

http.createServer(app).listen(app.get('port'), function() {
  console.log('Express server listening on port ' + app.get('port'));
});
