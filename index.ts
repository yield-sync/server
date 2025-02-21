// [import]
import bodyParser from "body-parser";
import history from "connect-history-api-fallback";
import cors from "cors";
import express from "express";
import http from "http";
import mysql from "mysql2";
import path from "path";

import config from "./config";
import rateLimiter from "./rate-limiter";
import routeApi from "./route/api";
import routeApiUser from "./route/api/user";
import routeApiPortfolio from "./route/api/portfolio";
import routeApiPortfolioAsset from "./route/api/portfolio-asset";


// [mysql] Connection Config
const dBConnection = mysql.createPool({
	database: "yield_sync",
	host: config.app.database.host,
	user: config.app.database.user,
	password: config.app.database.password,
	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 0
});

// [mysql] Connect
dBConnection.getConnection((error, connection) => {
	if (error)
	{
		console.error("MySQL Connection Error:", error.message);
		process.exit(1);
	}

	console.log("Successfully connected to MySQL DB");
	connection.release();
});

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
).use(
	express.static("frontend/dist")
);

// Catch-all route
app.get(
	"*",
	(req: express.Request, res: express.Response) =>
	{
		res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"));
	}
);


http.createServer(app).listen(
	config.port,
	() =>
	{
		console.log(`Server Running on Port: ${config.port}`)
	}
);
