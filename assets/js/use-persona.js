define(
	['use!https://login.persona.org/include.js', 'use!/vendor/zeptojs.com/zepto.js'],
	function(navigatorId, zepto) {
	
	// Code is derived from https://developer.mozilla.org/en-US/docs/Mozilla/Persona/Quick_Setup?redirectlocale=en-US&redirectslug=Persona%2FQuick_Setup which is licensed under public domain.
	// My changes are licensed under MIT
	
	var sessionClose = function() {
		$.ajax({
			type: 'DELETE',
			url: '/user/session', // This is a URL on your website.
			dataType: 'json',
			success: function(res, status, xhr) {
				window.location.reload();
			},
			error: function(xhr, status, err) {
				alert("Logout failure: " + err);
			}
		});
	};
	
	$('#passwordLogout').bind('click',sessionClose);
	
	if (!$('#mozillaPersona').length) { return; }
	
	$('#mozillaPersonaLogin').bind('click',function() {
		navigatorId.request();
	});
	
	$('#mozillaPersonaLogout').bind('click',function() {
		navigatorId.logout(); 
	});
	
	var mozillaPersonaUser = null;
	if (
		$('#mozillaPersonaUser').length &&
		$('#mozillaPersonaUser').val().length
	) {
		mozillaPersonaUser = $('#mozillaPersonaUser').val();
	}
	
	navigatorId.watch({
		loggedInUser: mozillaPersonaUser,
		onlogin: function(assertion) {
			
			// A user has logged in! Here you need to:
			// 1. Send the assertion to your backend for verification and to create a session.
			// 2. Update your UI.
			$.ajax({
				type: 'POST',
				dataType: 'json',
				url: '/user/browserid', // This is a URL on your website.
				data: {assertion: assertion},
				success: function(res, status, xhr) {
					window.location = window.location.protocol +
						'//' +
						window.location.host + 
						'';
						
				},
				error: function(xhr, status, err) {
					alert(
						"Login failure, please try again or use the internal " + "login / registration"
					);
					navigatorId.logout();
				}
			});
		},
		onlogout: sessionClose
	});

});
