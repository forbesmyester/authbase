var bcrypt = require('bcrypt'),
	crypto = require('crypto');

module.exports.generateRandomString = function(length,next) {
	var value = '';
	var addMore = function() {
		crypto.randomBytes(128, function(err, buf) {
			if (err) {
				return next(err);
			}
			value = value + buf.toString('base64').replace(/\//g,'').replace(/\+/g,'');
			if ( value.length < length ) {
				return addMore();
			}
			next(null, value.substr(0,length) );
		});
	};
	addMore();
};

module.exports.hasher = function(password,next) {
	bcrypt.genSalt(4, function(err, salt) {
		if (err) {
			return next(err);
		}
		bcrypt.hash(password, salt, function(er, hash) {
			return next(er,hash);
		});
	});
};

module.exports.checkAgainstHash = function(inputtedPassword,hashedPassword,next) {
	bcrypt.compare(
		inputtedPassword,
		hashedPassword,
		function(err,matches) {
			next(err,matches);
		}
	);
};

