require("dotenv").config();


export default
{
	// [heroku]
	nodeENV: process.env.NODE_ENV || "development",
	port: process.env.PORT || 5000,

	api: {
		brevo: {
			key: process.env.API__BREVO__KEY,
		},
		coingecko: {
			uRL: "https://api.coingecko.com/",
			key: process.env.API__COINGECKO__KEY,

		},
		financialModelingPrep: {
			uRL: "https://financialmodelingprep.com/",
			key: process.env.API__FINANCIAL_MODELING_PREP__KEY,
		},
		openfigi: {
			uRL: "https://api.openfigi.com/",
			key: process.env.API__OPEN_FIGI__KEY,
		},
	},

	app: {
		domain: "yieldsync.xyz",

		baseURL: {
			client: process.env.APP__BASE_URL || "http://localhost:8080",
			server: process.env.APP__BASE_URL || "http://localhost:5000",
		},

		database: {
			host: process.env.APP__DATABASE__HOST,
			user: process.env.APP__DATABASE__USER,
			password: process.env.APP__DATABASE__PASSWORD,
			port: process.env.APP__DATABASE__PORT,
			name: "yield_sync",
		},

		secretKey: process.env.APP__SECRET_KEY,
	},
};
