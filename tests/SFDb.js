var SFDb = require('../libs/SFDb.js'),
	expect = require('expect.js'),
	appConfig = require('../config'),
	db = require('mongoskin').db(
		appConfig.database_host +
			':' +
			appConfig.database_port +
			'/' +
			'_dev_utils_js_test',
		{w:true}
	);

describe('dbInserter says',function() {
	var sFDb = SFDb.createInstance(db);
	var col = db.collection('dev_utils_js_test');
	var tests = 2;
	var insertedRec = null;
	it('can insert',function(done) {
		col.remove(function() {
			col.ensureIndex({email: 1},{unique: 1},function() {
				sFDb.insert(
					'dev_utils_js_test',
					{_id:44,x:4,email:'bob@bob.com'},
					function(err,ir) {
						expect(err).to.equal(SFDb.ERROR.OK);
						insertedRec = ir;
						done();
					}
				);
			});
		});
	});
	it('can detect duplicate id',function(done) {
		sFDb.insert(
			'dev_utils_js_test',
			{_id:44,email:'jon@jon.com'},
			function(err, errVal) {
				expect(err).to.equal(SFDb.ERROR.DUPLICATE_ID);
				expect(errVal).to.equal('_id');
				done();
			}
		);
	});
	it('can detect duplicate unique field',function(done) {
		sFDb.insert(
			'dev_utils_js_test',
			{email:'bob@bob.com'},
			function(err, errVal) { 
				expect(err).to.equal(SFDb.ERROR.DUPLICATE_KEY);
				expect(errVal).to.equal('email');
				done();
			}
		);
	});
});

describe('modifyOne can',function() {
	var sFDb = SFDb.createInstance(db);

	it('return ERROR.NO_RESULTS when it cannot find what to edit',function(done) {
		sFDb.modifyOne(
			'db_utils_js_test',
			{this_should: 'never_exist'},
			{$set: {u: 'james', changed: true} },
			{},
			function(err, result) {
				expect(err).to.equal(SFDb.ERROR.NO_RESULTS);
				done();
			}
		);
	});

	it('return ERROR.NO_RESULTS when it cannot find what to edit',function(done) {
		var key = 'x' + new Date().getTime();

		sFDb.insert(
			'db_utils_js_test',
			{_id: key, u: 'bob'},
			function(err) {
				expect(err).to.equal(SFDb.ERROR.OK);
				sFDb.modifyOne(
					'db_utils_js_test',
					{_id: key},
					{$set: {u: 'james', changed: true} },
					{},
					function(err, result) {
						expect(err).to.equal(SFDb.ERROR.OK);
						expect(result.u).to.equal('james');
						expect(result.changed).to.equal(true);
						done();
					}
				);
			}
		);
	});
});


describe('findOne can',function() {
	it('return ERROR.OK with the correct data when data found',function(done) {
		var sFDb = SFDb.createInstance(db);
		var key = 'x' + new Date().getTime();

		sFDb.insert(
			'db_utils_js_test',
			{_id: key, u: 'bob'},
			function(err) {
				expect(err).to.equal(SFDb.ERROR.OK);
				sFDb.findOne(
					'db_utils_js_test',
					{_id: key},
					{},
					function(err, result) {
						expect(err).to.equal(SFDb.ERROR.OK);
						expect(result.u).to.equal('bob');
						expect(result._id).to.equal(key);
						done();
					}
				);
			}
		);

	});
	it('return ERROR.NO_RESULTS where there are none',function(done) {
		var sFDb = SFDb.createInstance(db);
		var col = db.collection('dev_utils_js_test');

		sFDb.findOne(
			'db_utils_js_test',
			{this_item: 'will_never_exist'},
			{},
			function(err, res) {
				expect(err).to.equal(SFDb.ERROR.NO_RESULTS);
				done();
			}
		);

	});
});
