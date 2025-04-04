import config from "../config";
import { validateEmail } from "./validation";


class HttpRequestError extends
	Error
{}


function getRecoveryEmail(recoveryPin: string)
{
	return {
		subject: "Recover Your Account",
		body: `
			<html>
				<body>
					<h1>Recover Your Account</h1>
					<p>
						If you did NOT request to recover your account please ignore this email.
						Do NOT share with anyone they may be trying to get unauthorized access to your account.
					</p>
					<h2>${recoveryPin}</h2>
				</body>
			</html>
		`,
	};
};

function getVerificationEmail(verificationPin: string)
{
	return {
		subject: "Verify Email",
		body: `
			<html>
				<body>
					<h1>Verify Your Account</h1>
					<p>Use the pin below to verify your account.</p>
					<h2>${verificationPin}</h2>
				</body>
			</html>
		`,
	};
};

export default {
	sendRecoveryEmail: async (toEmail: string, recoveryPin: string) => 
	{
		if (!validateEmail(toEmail))
		{
			throw new Error("❌ Invalid toEmail");
		}

		try
		{
			const email = getRecoveryEmail(recoveryPin);

			const response = await fetch(
				"https://api.brevo.com/v3/smtp/email",
				{
					method: "POST",
					headers: {
						"Accept": "application/json",
						"Content-Type": "application/json",
						"api-key": config.api.brevo.key,
					},
					body: JSON.stringify({
						sender: {
							name: "Yield Sync",
							email: `no-reply@${config.app.domain}`,
						},
						to: [
							{
								email: toEmail,
								name: "Valued User",
							},
						],
						subject: email.subject,
						htmlContent: email.body,
					}),
				}
			);

			if (!response.ok)
			{
				throw new HttpRequestError(`${response.status}`);
			}

			return await response.json();
		}
		catch (error)
		{
			console.error(error);
			throw new HttpRequestError(`Http Request Error: ${error}`);
		}
	},

	sendVerificationEmail: async (toEmail: string, verificationPin: string) => 
	{
		if (!validateEmail(toEmail))
		{
			throw new Error("❌ Invalid toEmail");
		}

		const email = getVerificationEmail(verificationPin);

		const response = await fetch(
			"https://api.brevo.com/v3/smtp/email",
			{
				method: "POST",
				headers: {
					"Accept": "application/json",
					"Content-Type": "application/json",
					"api-key": config.api.brevo.key,
				},
				body: JSON.stringify({
					sender: {
						name: "Yield Sync",
						email: `no-reply@${config.app.domain}`,
					},
					to: [
						{
							email: toEmail,
							name: "Valued User",
						},
					],
					subject: email.subject,
					htmlContent: email.body,
				}),
			}
		);

		if (!response.ok)
		{
			throw new HttpRequestError(`Http Request Error: ${response.status}`);
		}

		return await response.json();
	},
};
