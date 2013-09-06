module.exports = {

	"database_host": '192.168.122.28',
	"database_port": '27017',
	"database_name": 'authbase',
	"id_length": 8,
	"auth_length": 64,
	"activation_pad_length": 16,
	"email_test_collection": "emails",
	"cookie": {
		"domain": "cobol",
	},
	"auth_collection": "user_auth",
	"user_email_collection": "user_email",
	"user_password_collection": "user_password",
	"user_collection": "user",
	"email": {
		"register": {
			"from": "mistersync@keyboardwritescode.com",
			"subject_tempate": "Thanks for registering...",
			"text_template": "Hi {{name}},\nThanks for registering /user/{{_id}}/activate/{{activationPad}}"
		},
		"reactivation": {
			"from": "mistersync@keyboardwritescode.com",
			"subject_tempate": "Password reminder...",
			"text_template": "Hi {{name}},\nClick here to reset password /user/{{_id}}/activate/{{activationPad}}"
		}
	}
};
