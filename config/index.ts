// [require]
require("dotenv").config();


export default
{
	// [heroku]
	nodeENV: process.env.NODE_ENV || "development",
	port: process.env.PORT || 5000,

	api: {
		sendinblueKey: process.env.API__SENDINBLUE_KEY || "",
	},

	// [app]
	app: {
		// [base-url]
		baseURL: {
			client: process.env.APP__BASE_URL || "http://localhost:8080",
			server: process.env.APP__BASE_URL || "http://localhost:5000",
		},

		database: {
			host: process.env.DATABASE__HOST,
			user: process.env.DATABASE__USER,
			password: process.env.DATABASE__PASSWORD,
		},

		// [secret]
		secretKey: process.env.APP__SECRET_KEY || "secret",
	},
};
