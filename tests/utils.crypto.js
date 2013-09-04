var expect = require('expect.js'),
	dev_crypto = require('../libs/utils.crypto.js');

describe('generateRandomString says...',function() {
	it('will generate strings of different lengths',function(done) {
		dev_crypto.generateRandomString(8,function(err,ap) {
			expect(ap.length).to.equal(8);
			expect(ap).to.match(/^[A-Za-z0-9]+$/);
			dev_crypto.generateRandomString(16,function(err,ap) {
				expect(ap.length).to.equal(16);
				expect(ap).to.match(/^[A-Za-z0-9]+$/);
				dev_crypto.generateRandomString(22,function(err,ap) {
					expect(ap.length).to.equal(22);
					expect(ap).to.match(/^[A-Za-z0-9]+$/);
					done();
				});
			});
		});
	});
});

describe('hasher says...',function() {
	it('will hash passwords, but I need to check I can validate that back',function(done) {
		var password = 'Iwr1teC0de';
		dev_crypto.hasher(password,function(err,hashedPassword) {
			var doneN = 0;
			var maybeDone = function() {
				if (++doneN == 2) {
					done();
				}
			};
			dev_crypto.checkAgainstHash(
				'IDr1nkB3er',
				hashedPassword,
				function(err,matches) {
					expect(matches).to.equal(false);
					maybeDone();
				}
			);
			dev_crypto.checkAgainstHash(
				password,
				hashedPassword,
				function(err,matches) {
					expect(matches).to.equal(true);
					maybeDone();
				}
			);
		});
	});
});

