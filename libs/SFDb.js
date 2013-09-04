// Simple Functional Database.

var ERROR = {
	UNIDENTIFIED: 99,
	DUPLICATE_KEY: 2,
	DUPLICATE_ID: 1,
	NO_RESULTS: -1,
	OK: 0
};

var errorIsDuplicate = function(err) {
	return (err.code == 11000);
};

var getDuplicateKeyField = function(err) {
	var format = require('util').format,
		result = (/^[^\$]+\$([^ ]+)_[\d ]/).exec(err.err);
		
	if (result === null) {
		throw new Error(
			'UnableToIdentifyDuplicateKeyError: '+
			format('Unable to find duplicate key in %j',err)
		);
	}
	return result[1];
};

var SFDb = function(mongoskinConnection) {
	this._mongoskinConnection = mongoskinConnection;
};

SFDb.prototype.find = function(collection, query, options, callback) {
	// restrict options.sort to {fieldname: dir, fieldname: dir}
	// restrict limit to n
	// restrict skip to n
	throw "NOT IMPLEMENTED";
	
	
};

SFDb.prototype.findOne = function(collection, query, options, callback) {
	this._mongoskinConnection.collection(collection).findOne(
		query,
		function(err, results) {
		
			if (err) { throw err; }

			err = ERROR.OK;
			if (results === null) {
				err = ERROR.NO_RESULTS;
			}

			callback(err, results);

		}
	);
};

SFDb.prototype.modifyOne = function(collection, query, update, options, callback) {
	// options.sort is specified, first of query or id, it is then fed into api
	// options.new is forced on
	// options.upsert is forced off
	
	var sort = (function() {
		var r = {};
		if (options.sort) { return options.sort; }
		if (query) {
			return (function(q) {
				var k = '';
				for (k in q) {
					if (query.hasOwnProperty(k)) {
						r[k] = 1;
						return r;
					}
				}
			}(query));
		}
		return r;
	}());

	var myOptions = {'new': true, upsert: false, multi: false};

	this._mongoskinConnection.collection(collection).findAndModify(
		query,
		sort,
		update,
		myOptions,
		function(err, result) {
			if (err) { throw err; }
			
			if (result === null) {
				return callback(ERROR.NO_RESULTS, null);
			}

			return callback(ERROR.OK, result);
		}
	);
};

SFDb.prototype.insert = function(collection, insertData, callback) {
	
	this._mongoskinConnection.collection(collection).insert(
		insertData,
		{journal: true},
		function(mongoErr, results) {
			
			var err = 0;
			var errVal = null;

			if (mongoErr) {
				err = ERROR.UNIDENTIFIED;
				if (errorIsDuplicate(mongoErr)) {
					err = ERROR.DUPLICATE_KEY;
					errVal = getDuplicateKeyField(mongoErr);
					if (errVal == '_id') {
						err = ERROR.DUPLICATE_ID;
					}
				}
				return callback(err, errVal);
			}

			if (results.length < 1) {
				err = ERROR.NO_RESULTS;
			}

			callback(err, results.length ? results[0] : null);

		}
	);
};

SFDb.prototype.addIndexes = function(indexes, next) {
	(function(db) {
		
		var format = require('util').format;
		
		var addOneIndexThenMore = function() {
			
			if (indexes.length) {
				var index = indexes.shift();
				db.collection(index.collection).ensureIndex(
					index.index,
					index.options,
					function(err,name) {
						if (err) {
							throw new Error(
								'InitErrorOnEnsureIndex: ' +
								format(
									'Error creating Index %j (%j)',
									indexes[0],
									err
								)
							);
						}
						addOneIndexThenMore.call();
					}
				);
			} else {
				if (typeof next == 'function') next();
			}
			
		};
		
		addOneIndexThenMore();
		
	})(this._mongoskinConnection);
};

module.exports = {
	createInstance: function(mongoskinConnection) {
		return new SFDb(mongoskinConnection);
	},
	ERROR: ERROR
};
