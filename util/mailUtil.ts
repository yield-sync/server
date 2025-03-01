//import config from "../config"
import { validateEmail } from "./validation";

// [require]
const brevo = require("@getbrevo/brevo");


//const defaultClient = brevo.ApiClient.instance;

//let apiKey = defaultClient.authentications['api-key'];
//apiKey.apiKey = config.api.sendinblueKey;

//const API_INSTANCE = new brevo.TransactionalEmailsApi();


export const sendRecoveryEmail = (to: string) =>
{
	if (!validateEmail(to))
	{
		return;
	}

	let sendSmtpEmail = new brevo.SendSmtpEmail();

	sendSmtpEmail.subject = "Recover Your Account";

	sendSmtpEmail.htmlContent = `
	<html>
	<body>
		<h1>Recover Your Account</h1>
		<p>
			If you did NOT request to recover your account please ignore this email.
			Do NOT share with anything they may be trying to get unauthorized access to your account.
		</p>
	</body>
	</html>
	`;

	sendSmtpEmail.sender = {
		"name": "John Doe",
		"email": "example@example.com",
	};

	sendSmtpEmail.to = [
		{
			"email": to,
		},
	];

	sendSmtpEmail.bcc = [
	];

	sendSmtpEmail.replyTo = {
		"email": "replyto@domain.com",
		"name": "John Doe",
	};

	sendSmtpEmail.headers = {
		"Some-Custom-Name": "unique-id-1234",
	};

	sendSmtpEmail.params = {
		"parameter": "My param value",
		"subject": "New Subject",
	};

//	API_INSTANCE.sendTransacEmail(sendSmtpEmail).then(
//		function(data)
//		{
//			console.log('API called successfully. Returned data: ' + JSON.stringify(data));
//		},
//		function(error)
//		{
//			console.error(error);
//		}
//	);
};

export const setVerificationEmail = (to: string) =>
{
	return;
};
