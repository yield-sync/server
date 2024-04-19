// [import]
import bodyParser from "body-parser";
import history from "connect-history-api-fallback";
import cors from "cors";
import express from "express";
import http from "http";
import mysql from "mysql";
import path from "path";

import config from "./config";
import rateLimiter from "./rate-limiter";
import routeApi from "./route/api";
import routeApiUser from "./route/api/user";
import routeApiPortfolio from "./route/api/portfolio";
import routeApiPortfolioAsset from "./route/api/portfolio-asset";


// [mysql] Connection Config
const dBConnection: mysql.Connection = mysql.createConnection({
	database: "yield_sync",
	host: config.app.database.host,
	user: config.app.database.user,
	password: config.app.database.password,
});

// [mysql] Connect
dBConnection.connect(
	async (error: Error) =>
	{
		if (error)
		{
			throw new Error(error.message);
		}

		console.log("Successfully connected to MySQL DB");
	}
);


const app: express.Express = express().use(bodyParser.json()).use(bodyParser.urlencoded({ extended: false })).use(
	cors()
).use(
	express.static(__dirname + "/static")
).use(
	rateLimiter.global
).use(
	history({
		rewrites: [
			{
				from: /^\/api.*$/,
				to: function (context)
				{
					return context.parsedUrl.path;
				}
			},
		]
	})
).use(
	"/api",
	routeApi()
).use(
	"/api/portfolio",
	routeApiPortfolio(dBConnection)
).use(
	"/api/portfolio-asset",
	routeApiPortfolioAsset(dBConnection)
).use(
	"/api/user",
	routeApiUser(dBConnection)
);


// [heroku] Set Static Folder
if (config.nodeENV == "production")
{
	app.use(express.static("client/dist"));

	app.get(
		"*",
		(req: express.Request, res: express.Response) =>
		{
			res.sendFile(path.resolve(__dirname, "frontend", "dist", "index.html"));
		}
	);
}


http.createServer(app).listen(
	config.port,
	() =>
	{
		console.log(`Server Running on Port: ${config.port}`)
	}
);
