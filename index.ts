class InitializationError extends
	Error
{}

import bodyParser from "body-parser";
import history from "connect-history-api-fallback";
import cors from "cors";
import express from "express";
import fs from 'fs';
import http from "http";
import mysql from "mysql2";
import path from "path";

import config from "./config";
import { INTERNAL_SERVER_ERROR, hTTPStatus } from "./constants";
import rateLimiter from "./rate-limiter";
import routeApi from "./route/api";
import routeApiCryptocurrency from "./route/api/cryptocurrency";
import routeApiPortfolio from "./route/api/portfolio";
import routeApiPortfolioAsset from "./route/api/portfolio-asset";
import routeApiStock from "./route/api/stock";
import routeApiUser from "./route/api/user";


if (
	!config.app.database.host ||
	!config.app.database.name ||
	!config.app.database.password ||
	!config.port ||
	!config.app.database.user
)
{
	throw new InitializationError("Missing required configuration values");
}

const MYSQL_POOL: mysql.Pool = mysql.createPool({
	host: config.app.database.host,
	database: config.app.database.name,
	password: config.app.database.password,
	port: Number(config.app.database.port),
	user: config.app.database.user,
	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 0,
}).on("connection", (connection) => {
	console.log("✅ Server successfully connected to the MySQL Database")
}).on("error", (err) => {
	console.error("MySQL Create Pool Error:", err);
});


http.createServer(
	express().use(bodyParser.json()).use(bodyParser.urlencoded({
		extended: false,
	})).use(cors()).use(
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
					},
				},
			],
		})
	).use(
		"/api",
		routeApi()
	).use(
		"/api/cryptocurrency",
		routeApiCryptocurrency(MYSQL_POOL)
	).use(
		"/api/portfolio",
		routeApiPortfolio(MYSQL_POOL)
	).use(
		"/api/portfolio-asset",
		routeApiPortfolioAsset(MYSQL_POOL)
	).use(
		"/api/stock",
		routeApiStock(MYSQL_POOL)
	).use(
		"/api/user",
		routeApiUser(MYSQL_POOL)
	).use(
		express.static("frontend/dist")
	).get(
		"*",
		(req: express.Request, res: express.Response) =>
		{
			const filePath = path.join(__dirname, "frontend", "dist", "index.html")

			if (!fs.existsSync(filePath))
			{
				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).json({
					message: INTERNAL_SERVER_ERROR,
					error: `${filePath} does not exist`
				});

				return;
			}

			res.sendFile(filePath);
		}
	)
).listen(
	config.port,
	() =>
	{
		console.log(`Server Running on Port: ${config.port}`);
	}
);
