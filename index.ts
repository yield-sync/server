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


const dBConnection = mysql.createPool({
	database: "yield_sync",
	host: config.app.database.host,
	user: config.app.database.user,
	password: config.app.database.password,
	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 0
});


http.createServer(
	express().use(bodyParser.json()).use(bodyParser.urlencoded({ extended: false })).use(
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
	).get(
		"*",
		(req: express.Request, res: express.Response) =>
		{
			res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"));
		}
	)
).listen(
	config.port,
	() =>
	{
		console.log(`Server Running on Port: ${config.port}`)
	}
);
