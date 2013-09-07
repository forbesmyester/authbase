require.config({
	baseUrl: '/js',
	paths: {
		use: "/vendor-bower/use.js/use"
	},
	use: {
		"https://login.persona.org/include.js": {
			attach: function() { return navigator.id; }
		},
		"/vendor/zeptojs.com/zepto.js": {
			attach: function() { return navigator.id; }
		}
	}
});

define(['use-persona'], function( ) {
	
	
});
