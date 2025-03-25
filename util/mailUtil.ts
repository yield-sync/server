import config from "../config";
import { validateEmail } from "./validation";


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

	const mailchimpClient = require("@mailchimp/mailchimp_transactional")(config.api.mailchimp.key);

	return await mailchimpClient.messages.send({
		message: {
			from_email: `admin@${config.app.domain}`,
			to: [
				{
					email: to,
					type: "to",
				},
			],
			subject: email.subject,
			html: email.body,
		},
	});
};

export const setVerificationEmail = (to: string) =>
{
	return;
};

export default {
	sendRecoveryEmail,
	setVerificationEmail
}
