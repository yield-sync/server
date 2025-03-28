import config from "../config";
import { validateEmail } from "./validation";


function getRecoveryEmail(recoveryPassword: string)
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

	const recoveryPassword: string = "";

	const email = getRecoveryEmail(recoveryPassword);

	const response = await fetch(
		"https://api.brevo.com/v3/smtp/email",
		{
			method: "POST",
			headers: {
				"Accept": "application/json",
				"Content-Type": "application/json",
				"api-key": config.api.brevo.key
			},
			body: JSON.stringify({
				sender: {
					name: "Yield Sync",
					email: `no-reply@${config.app.domain}`
				},
				to: [
					{
						email: to,
						name: "Valued User"
					}
				],
				subject: email.subject,
				htmlContent: email.body
			}),
		}
	);

	if (!response.ok)
	{
		throw new Error(`HTTP error! Status: ${response.status}`);
	}

	return await response.json();
};

export const setVerificationEmail = (to: string) =>
{
	return;
};

export default {
	sendRecoveryEmail,
	setVerificationEmail
}
