// [import-personal]
import config from "../config"

// [require]
const SibApiV3Sdk = require('sib-api-v3-typescript');


let apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

let apiKey = apiInstance.authentications['apiKey'];

apiKey.apiKey = config.api.sendinblueKey;

let sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

sendSmtpEmail.subject = "My {{params.subject}}";
sendSmtpEmail.htmlContent = "<html><body><h1>This is my first transactional email {{params.parameter}}</h1></body></html>";
sendSmtpEmail.sender = {"name":"John Doe","email":"example@example.com"};
sendSmtpEmail.to = [{"email":"example@example.com","name":"Jane Doe"}];
sendSmtpEmail.cc = [{"email":"example2@example2.com","name":"Janice Doe"}];
sendSmtpEmail.bcc = [{"name":"John Doe","email":"example@example.com"}];
sendSmtpEmail.replyTo = {"email":"replyto@domain.com","name":"John Doe"};
sendSmtpEmail.headers = {"Some-Custom-Name":"unique-id-1234"};
sendSmtpEmail.params = {"parameter":"My param value","subject":"New Subject"};

apiInstance.sendTransacEmail(sendSmtpEmail).then(
	function(data)
	{
		console.log('API called successfully. Returned data: ' + JSON.stringify(data));
	},
	function(error)
	{
		console.error(error);
	}
);

export default async (email: string) =>
{
	return;
};
