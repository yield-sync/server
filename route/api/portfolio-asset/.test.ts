import express from "express";
import mysql from "mysql2";

import routeApiPortfolioAsset from "./index";
import routeApi from "../index";
import routeApiAsset from "../stock/index";
import routeApiPortfolio from "../portfolio/index";
import routeApiUser from "../user/index";
import config from "../../../config";
import DBBuilder, { dBDrop } from "../../../sql/db-builder";


const request = require('supertest');


const ASSET_NAME: string = "Asset";
const ASSET_SYMBOL: string = "ASS";
const DB_NAME: string = "mock_db_portfolio_asset";
const EMAIL: string = "testemail@example.com";
const PASSWORD: string = "testpassword!";
const PORTFOLIO_NAME: string = "my-portfolio";

let token: string;
let stock_id: string;
let portfolioId: string;
let app: express.Express;
let mySQLPool: mysql.Pool;


afterAll(async () =>
{
	await dBDrop(DB_NAME, mySQLPool);

	await mySQLPool.end();
});

beforeAll(async () =>
{
	mySQLPool = mysql.createPool({
		host: config.app.database.host,
		user: config.app.database.user,
		password: config.app.database.password,
		waitForConnections: true,
		connectionLimit: 10,
		queueLimit: 0
	});

	await mySQLPool.promise().getConnection();

	await DBBuilder(mySQLPool, DB_NAME, true);

	await mySQLPool.promise().query("USE ??;", [DB_NAME]);

	app = express().use(express.json()).use("/api", routeApi()).use(
		"/api/stock",
		routeApiAsset(mySQLPool)
	).use(
		"/api/user",
		routeApiUser(mySQLPool)
	).use(
		"/api/portfolio",
		routeApiPortfolio(mySQLPool)
	).use(
		"/api/portfolio-asset",
		routeApiPortfolioAsset(mySQLPool)
	);
});

beforeEach(async () =>
{
	// Drop the database
	await dBDrop(DB_NAME, mySQLPool);

	// [mock-db] drop and recreate
	await DBBuilder(mySQLPool, DB_NAME, true);

	// Create a user
	await request(app).post("/api/user/create").send({
		load: {
			email: EMAIL,
			password: PASSWORD
		}
	}).expect(201);

	// Promote user to admin
	await mySQLPool.promise().query("UPDATE user SET admin = b'1' WHERE email = ?;", [EMAIL]);

	const resLogin = await request(app).post("/api/user/login").send({
		load: {
			email: EMAIL,
			password: PASSWORD
		}
	}).expect(200);

	token = (JSON.parse(resLogin.text)).token;

	expect(typeof token).toBe("string");

	// Create a portfolio
	const resPortfolioCreate = await request(app).post("/api/portfolio/create").set(
		'authorization',
		`Bearer ${token}`
	).send({
		load: {
			name: PORTFOLIO_NAME
		} as PortfolioCreate
	});

	expect(resPortfolioCreate.statusCode).toBe(201);

	const [portfolios]: MySQLQueryResult = await mySQLPool.promise().query(
		"SELECT id FROM portfolio WHERE name = ?;", [PORTFOLIO_NAME]
	);

	portfolioId = portfolios[0].id;

	await mySQLPool.promise().query(
		"INSERT INTO stock (symbol, name, exchange, isin) VALUES (?, ?, ?, ?);",
		[
			ASSET_SYMBOL,
			ASSET_NAME,
			"nasdaq",
			"123",
		]
	);

	const [assets]: MySQLQueryResult = await mySQLPool.promise().query(
		"SELECT id FROM stock WHERE name = ?;", [ASSET_NAME]
	);

	stock_id = assets[0].id;
});


describe("Request: GET", () =>
{
	describe("Route: /api/portfolio-asset/", () =>
	{
		describe("Expected Failure", () =>
		{
			it("[auth] Should require a user token to insert portfolio asset into DB..", async () =>
			{
				await request(app).post("/api/portfolio-asset/create").send({
					load: {
						portfolioId,
						stock_id,
					} as PortfolioAssetCreate
				}).expect(401);

				const [results]: MySQLQueryResult = await mySQLPool.promise().query("SELECT * FROM portfolio_asset;");

				if (!Array.isArray(results))
				{
					throw new Error("Expected result is not Array");
				}

				expect(results.length).toBe(0);
			});

			it("Should fail if no portfolioId passed..", async () =>
			{
				const RES = await request(app).post("/api/portfolio-asset/create").set(
					'authorization',
					`Bearer ${token}`
				).send({ load: { stock_id, } }).expect(400);

				expect(RES.text).toBe("No portfolioId received");

				const [results]: MySQLQueryResult = await mySQLPool.promise().query("SELECT * FROM portfolio_asset;");

				if (!Array.isArray(results))
				{
					throw new Error("Expected result is not Array");
				}

				expect(results.length).toBe(0);
			});

			it("Should fail if no portfolio asset_id passed..", async () =>
			{
				const RES = await request(app).post("/api/portfolio-asset/create").set(
					'authorization',
					`Bearer ${token}`
				).send({
					load: {
						portfolioId: portfolioId,
					}
				}).expect(400);

				expect(RES.text).toBe("No stock_id received");

				const [results]: MySQLQueryResult = await mySQLPool.promise().query("SELECT * FROM portfolio_asset;");

				if (!Array.isArray(results))
				{
					throw new Error("Expected result is not Array");
				}

				expect(results.length).toBe(0);
			});
		});

		describe("Expected Success", () =>
		{
			it("Should insert portfolio asset into database..", async () =>
			{
				const RES_PORTFOLIO_ASSET = await request(app).post("/api/portfolio-asset/create").set(
					'authorization',
					`Bearer ${token}`
				).send({
					load: {
						portfolioId: portfolioId,
						stock_id: stock_id,
					} as PortfolioAssetCreate
				});

				expect(RES_PORTFOLIO_ASSET.statusCode).toBe(201);

				const [portfolioAssests]: MySQLQueryResult = await mySQLPool.promise().query("SELECT * FROM portfolio_asset;");

				if (!Array.isArray(portfolioAssests))
				{
					throw new Error("Expected result is not Array");
				}

				expect(portfolioAssests.length).toBeGreaterThan(0);

				if (!("stock_id" in portfolioAssests[0]))
				{
					throw new Error("Key 'stock_id' not in portfolioAssets");
				}

				expect(portfolioAssests[0].stock_id).toBe(stock_id);

				if (!("portfolio_id" in portfolioAssests[0]))
				{
					throw new Error("Key 'portfolio_id' not in portfolioAssets");
				}

				expect(portfolioAssests[0].portfolio_id).toBe(portfolioId);
			});
		});
	});
});
