import config from "../config";
import { validateEmail } from "./validation";

const brevo = require("@getbrevo/brevo");


function getRecoveryEmail(recoveryPassword: string = "")
{
	return {
		subject: "Recover Your Account",
		body: `
			<html>
				<body>
					<h1>Recover Your Account</h1>
					<p>
						If you did NOT request to recover your account please ignore this email.
						Do NOT share with anything they may be trying to get unauthorized access to your account.

						To recover your account please visit the following link:
						<a href="${config.app.domain}/recover/${recoveryPassword}">
					</p>
				</body>
			</html>
		`,
	};
}


export const sendRecoveryEmail = async (to: string) =>
{
	if (!validateEmail(to))
	{
		throw new Error("Invalid to email");
	}

	const email = getRecoveryEmail()

	let defaultClient = brevo.ApiClient.instance;

	let apiKey = defaultClient.authentications['apiKey'];

	apiKey.apiKey = config.api.mailchimp.key;

	let apiInstance = new brevo.TransactionalEmailsApi();
	let sendSmtpEmail = new brevo.SendSmtpEmail();

	sendSmtpEmail.subject = email.subject;
	
	sendSmtpEmail.htmlContent = email.body;

	sendSmtpEmail.sender = {
		"name": "Auto",
		"email": `no-reply@${config.app.domain}`
	};
	
	sendSmtpEmail.to = [
		{
			"email": to,
			"name": "Name Here"
		}
	];
	
	sendSmtpEmail.replyTo = { "email": "example@brevo.com", "name": "sample-name" };
	
	sendSmtpEmail.headers = { "Some-Custom-Name": "unique-id-1234" };
	
	sendSmtpEmail.params = { "parameter": "My param value", "subject": "common subject" };

	apiInstance.sendTransacEmail(sendSmtpEmail).then(
		function (data) {
			console.log('API called successfully. Returned data: ' + JSON.stringify(data));
		},
		function (error) {
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
