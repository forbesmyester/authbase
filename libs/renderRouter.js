module.exports = function(routes, input) {
	
	var inputSplit = input.split('/'),
		inputLength = inputSplit.length,
		k;
		
	function matches(routeSplit) {
		var i;
		if (routeSplit.length != inputSplit.length) { return false; }
		for (i=0; i<inputLength; i++) {
			if ((routeSplit[i] !== '') && (inputSplit[i] != routeSplit[i])) {
				return false;
			}
		}
		return true;
	}
	
	for (k in routes) { if (routes.hasOwnProperty(k)) {
		if (matches(k.split('/'),inputSplit)) {
			console.log(k);
			return routes[k]
		}
	} }
	console.log("Cound not find Render function for '" + input + "'");
	return null;
}
