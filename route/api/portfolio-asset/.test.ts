import express from "express";
import mysql from "mysql2";

import routeApiPortfolioAsset from "./index";
import routeApi from "../index";
import routeApiAsset from "../asset/index";
import routeApiPortfolio from "../portfolio/index";
import routeApiUser from "../user/index";
import config from "../../../config";
import DBBuilder, { dBDrop } from "../../../sql/db-builder";


const request = require('supertest');


const ASSET_NAME: string = "Asset";
const ASSET_SYMBOL: string = "A";
const DB_NAME: string = "mock_db_portfolio_asset";
const EMAIL: string = "testemail@example.com";
const PASSWORD: string = "testpassword!";
const PORTFOLIO_NAME: string = "my-portfolio";

let token: string;
let stock_isin: string;
let portfolio_id: string;
let app: express.Express;
let mySQLPool: mysql.Pool;


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

	portfolio_id = portfolios[0].id;

	await mySQLPool.promise().query(
		"INSERT INTO stock (symbol, name, exchange, isin, sector, industry) VALUES (?, ?, ?, ?, ?, ?);",
		[
			ASSET_SYMBOL,
			ASSET_NAME,
			"nasdaq",
			"123",
			"Technology",
			"Consumer Electronics",
		]
	);

	const [assets]: MySQLQueryResult = await mySQLPool.promise().query(
		"SELECT isin FROM stock WHERE name = ?;", [ASSET_NAME]
	);

	stock_isin = assets[0].isin;
});


describe("Request: GET", () => {
	describe("Route: /api/portfolio-asset/create", () => {
		describe("Expected Failure", () => {
			it("[auth] Should require a user token to insert portfolio asset into DB..", async () => {
				await request(app).post("/api/portfolio-asset/create").send({
					load: {
						portfolio_id,
						stock_isin,
					} as PortfolioAssetCreate
				}).expect(401);

				const [results]: MySQLQueryResult = await mySQLPool.promise().query("SELECT * FROM portfolio_asset;");

				if (!Array.isArray(results))
				{
					throw new Error("Expected result is not Array");
				}

				expect(results.length).toBe(0);
			});

			it("Should fail if no portfolio stock_isin or cryptocurrency_id provided..", async () => {
				const RES = await request(app).post("/api/portfolio-asset/create").set(
					'authorization',
					`Bearer ${token}`
				).send({
					load: {
						portfolio_id: portfolio_id,
					}
				}).expect(400);

				expect(RES.body.message).toBe("❓ No stock_isin received");

				const [results]: MySQLQueryResult = await mySQLPool.promise().query("SELECT * FROM portfolio_asset;");

				if (!Array.isArray(results))
				{
					throw new Error("Expected result is not Array");
				}

				expect(results.length).toBe(0);
			});

			it("Should fail if no percent_allocation passed..", async () => {
				const RES = await request(app).post("/api/portfolio-asset/create").set(
					'authorization',
					`Bearer ${token}`
				).send({
					load: {
						portfolio_id,
						stock_isin,
					}
				}).expect(400);

				expect(RES.body.message).toBe("❓ No percent_allocation received");

				const [results]: MySQLQueryResult = await mySQLPool.promise().query("SELECT * FROM portfolio_asset;");

				if (!Array.isArray(results))
				{
					throw new Error("Expected result is not Array");
				}

				expect(results.length).toBe(0);
			});

			it("Should fail if no balance passed..", async () => {
				const RES = await request(app).post("/api/portfolio-asset/create").set(
					'authorization',
					`Bearer ${token}`
				).send({
					load: {
						portfolio_id,
						stock_isin,
						percent_allocation: 0,
					}
				}).expect(400);

				expect(RES.body.message).toBe("❓ No balance received");

				const [results]: MySQLQueryResult = await mySQLPool.promise().query("SELECT * FROM portfolio_asset;");

				if (!Array.isArray(results))
				{
					throw new Error("Expected result is not Array");
				}

				expect(results.length).toBe(0);
			});
		});

		describe("Expected Success", () => {
			it("Should insert portfolio asset into database..", async () => {
				const RES_PORTFOLIO_ASSET = await request(app).post("/api/portfolio-asset/create").set(
					'authorization',
					`Bearer ${token}`
				).send({
					load: {
						portfolio_id,
						stock_isin,
						percent_allocation: 0,
						balance: 0,
					} as PortfolioAssetCreate
				});

				expect(RES_PORTFOLIO_ASSET.statusCode).toBe(201);

				const [portfolioAssests]: MySQLQueryResult = await mySQLPool.promise().query("SELECT * FROM portfolio_asset;");

				if (!Array.isArray(portfolioAssests))
				{
					throw new Error("Expected result is not Array");
				}

				expect(portfolioAssests.length).toBeGreaterThan(0);

				if (!("stock_isin" in portfolioAssests[0]))
				{
					throw new Error("Key 'stock_isin' not in portfolioAssets");
				}

				expect(portfolioAssests[0].stock_isin).toBe(stock_isin);

				if (!("portfolio_id" in portfolioAssests[0]))
				{
					throw new Error("Key 'portfolio_id' not in portfolioAssets");
				}

				expect(portfolioAssests[0].portfolio_id).toBe(portfolio_id);
			});
		});

		describe("Expected Failure (2)", () => {
			it("Should fail if to insert percent_allocation > 10_000..", async () => {
				const response = await request(app).post("/api/portfolio-asset/create").set(
					'authorization',
					`Bearer ${token}`
				).send({
					load: {
						portfolio_id,
						stock_isin,
						percent_allocation: 10_001,
						balance: 0,
					} as PortfolioAssetCreate
				});

				expect(response.statusCode).toBe(400);

				expect(response.body.message).toBe("❌ Invalid percent_allocation");
			});

			it("Should fail if to insert percent_allocation < 0..", async () => {
				const response = await request(app).post("/api/portfolio-asset/create").set(
					'authorization',
					`Bearer ${token}`
				).send({
					load: {
						portfolio_id,
						stock_isin,
						percent_allocation: -1,
						balance: 0,
					} as PortfolioAssetCreate
				});

				expect(response.statusCode).toBe(400);

				expect(response.body.message).toBe("❌ Invalid percent_allocation");
			});
		});
		describe("Route: /api/portfolio-asset/update", () => {
			describe("Expected Failure", () => {
				it("[auth] Should require a user token to insert portfolio asset into DB..", async () => {
					await request(app).put("/api/portfolio-asset/update/invalid-id").send().expect(401);

					const [results]: MySQLQueryResult = await mySQLPool.promise().query("SELECT * FROM portfolio_asset;");

					if (!Array.isArray(results))
					{
						throw new Error("Expected result is not Array");
					}

					expect(results.length).toBe(0);
				});

				it("Should fail if no balance passed..", async () => {
					const RES = await request(app).put("/api/portfolio-asset/update/invalid-id").set(
						'authorization',
						`Bearer ${token}`
					).send({ load: { } }).expect(400);

					expect(RES.body.message).toBe("❓ No balance received");

					const [results]: MySQLQueryResult = await mySQLPool.promise().query("SELECT * FROM portfolio_asset;");

					if (!Array.isArray(results))
					{
						throw new Error("Expected result is not Array");
					}

					expect(results.length).toBe(0);
				});

				it("Should fail if no percent_allocation passed..", async () => {
					const RES = await request(app).put("/api/portfolio-asset/update/invalid-id").set(
						'authorization',
						`Bearer ${token}`
					).send({
						load: {
							balance: 0,
						}
					}).expect(400);

					expect(RES.body.message).toBe("❓ No percent_allocation received");

					const [results]: MySQLQueryResult = await mySQLPool.promise().query("SELECT * FROM portfolio_asset;");

					if (!Array.isArray(results))
					{
						throw new Error("Expected result is not Array");
					}

					expect(results.length).toBe(0);
				});
			});

			describe("Expected Success", () => {
				it("Should update portfolio asset in the database..", async () => {
					await request(app).post("/api/portfolio-asset/create").set(
						'authorization',
						`Bearer ${token}`
					).send({
						load: {
							portfolio_id,
							stock_isin,
							percent_allocation: 100,
							balance: 0,
						} as PortfolioAssetCreate
					});

					const RES_PORTFOLIO_ASSET = await request(app).put("/api/portfolio-asset/update/1").set(
						'authorization',
						`Bearer ${token}`
					).send({
						load: {
							balance: 100,
							percent_allocation: 100,
						} as PortfolioAssetUpdate
					});

					expect(RES_PORTFOLIO_ASSET.statusCode).toBe(201);

					const [portfolioAssests]: MySQLQueryResult = await mySQLPool.promise().query(
						"SELECT * FROM portfolio_asset;"
					);

					if (!Array.isArray(portfolioAssests))
					{
						throw new Error("Expected result is not Array");
					}

					expect(portfolioAssests.length).toBeGreaterThan(0);

					if (!("stock_isin" in portfolioAssests[0]))
					{
						throw new Error("Key 'stock_isin' not in portfolioAssets");
					}

					expect(portfolioAssests[0].stock_isin).toBe(stock_isin);

					if (!("portfolio_id" in portfolioAssests[0]))
					{
						throw new Error("Key 'portfolio_id' not in portfolioAssets");
					}

					expect(portfolioAssests[0].portfolio_id).toBe(portfolio_id);

					if (!("balance" in portfolioAssests[0]))
					{
						throw new Error("Key 'balance' not in portfolioAssets");
					}

					expect(Number(portfolioAssests[0].balance)).toBe(100);

					if (!("percent_allocation" in portfolioAssests[0]))
					{
						throw new Error("Key 'percent_allocation' not in portfolioAssets");
					}

					expect(Number(portfolioAssests[0].percent_allocation)).toBe(100);
				});
			});
		});
	});
});

describe("Request: PUT", () => {});

describe("Request: DELETE", () => {});


afterAll(async () => {
	await dBDrop(DB_NAME, mySQLPool);

	await mySQLPool.end();
});
