//import config from "../config"
import config from "../config";
import { validateEmail } from "./validation";

const brevo = require("@getbrevo/brevo");


export const sendRecoveryEmail = (to: string) =>
{
	if (!validateEmail(to))
	{
		throw new Error("Invalid to email");
	}

	const apiInstance = new brevo.TransactionalEmailsApi();

	let apiKey = apiInstance.authentications['apiKey'];

	apiKey.apiKey = config.api.brevo.key;

	let sendSmtpEmail = new brevo.SendSmtpEmail();

	sendSmtpEmail.subject = "Recover Your Account";

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

	apiInstance.sendTransacEmail(sendSmtpEmail).then(
		function (data)
		{
			console.log('API called successfully. Returned data: ' + JSON.stringify(data));
		},
		function (error)
		{
			console.error(error);
		}
	);
};

export const setVerificationEmail = (to: string) =>
{
	return;
};

export default {
	sendRecoveryEmail,
	setVerificationEmail
}
