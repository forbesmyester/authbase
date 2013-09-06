/**
 * # F Validator = EF VARLidator...
 */

var efvarl = function(checksets,data) {
	
	var k = '',
		tmp,
		ret = {};
	
	var processCheckset = function(name,checkset,data) {
		var format = require('util').format,
			error = false, // The list of errors to be returned
			i = 0,
			val = ''; // Current value of input (modified by filters)
			
		if (!data.hasOwnProperty(name)) {
			data[name] = null;
		}
		
		if ( checkset.required && (data[name] === null) ) {
			error = checkset.hasOwnProperty('missingMessage') ?
					checkset.missingMessage :
					format('Missing field "%s"',name);
		}
		
		if (error === false) {
			
			val = data[name];
		
			for (i=0; i<checkset.filters.length; i++) {
				val = checkset.filters[i].call(this,val);
			}
		
			try {
				for (i=0; i<checkset.checks.length; i++) {
					checkset.checks[i].call(this,val);
				}
			} catch (e) {
				error = e.message;
			}
		}
		
		return { error:error, value:val };
		
	};
	
	ret = {
		errors: {},
		data: {},
		hasErrors: false
	};
	
	for (k in checksets) {
		if (checksets.hasOwnProperty(k)) {
			tmp = processCheckset(k,checksets[k],data);
			if (tmp.error !== false) {
				ret.errors[k] = tmp.error;
				ret.hasErrors = true;
			}
			ret.data[k] = tmp.value;
		}
	}
	return ret;
};


module.exports = efvarl;
