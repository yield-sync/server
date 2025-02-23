import express from "express";
import mysql from "mysql2";

import routeApiPortfolioAsset from "./index";
import routeApi from "../index";
import routeApiAsset from "../asset/index";
import routeApiPortfolio from "../portfolio/index";
import routeApiUser from "../user/index";
import config from "../../../config";
import DBBuilder, { dropDB } from "../../../sql/db-builder";


const request = require('supertest');


const ASSET_NAME: string = "Asset";
const ASSET_SYMBOL: string = "ASS";
const DB_NAME: string = "mock_db_portfolio_asset";
const EMAIL: string = "testemail@example.com";
const PASSWORD: string = "testpassword!";
const PORTFOLIO_NAME: string = "my-portfolio";
const TICKER: string = "PS";

let token: string;
let asset_id: string;
let portfolio_id: string;
let app: express.Express;
let mySQLPool: mysql.Pool;


afterAll(async () =>
{
	await dropDB(DB_NAME, mySQLPool);

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
		"/api/asset",
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
	await dropDB(DB_NAME, mySQLPool);

	// [mock-db] drop and recreate
	await DBBuilder(mySQLPool, DB_NAME, true);

	// Create a user
	await request(app).post("/api/user/create").send({
		load: {
			email: EMAIL,
			password: PASSWORD
		}
	}).expect(201);

	// Send a login request
	const resLogin = await request(app).post("/api/user/login").send({
		load: {
			email: EMAIL,
			password: PASSWORD
		}
	}).expect(200);

	token = (JSON.parse(resLogin.text)).token;

	expect(typeof token).toBe("string");

	// Create a portfolio
	const resPortfolioCreate = await request(app).get("/api/portfolio/create").set(
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

	// Create an asset
	const resAssetCreate = await request(app).get("/api/asset/create").set(
		'authorization',
		`Bearer ${token}`
	).send({
		load: {
			name: ASSET_NAME,
			symbol: ASSET_SYMBOL,
		} as AssetCreate
	});

	expect(resAssetCreate.statusCode).toBe(201);

	const [assets]: MySQLQueryResult = await mySQLPool.promise().query(
		"SELECT id FROM asset WHERE name = ?;", [ASSET_NAME]
	);

	asset_id = assets[0].id;
});


describe("ROUTE: /api/portfolio-asset", () =>
{
	describe("GET /", () =>
	{
		describe("Expected Failures", () =>
		{
			test("[auth] Should require a user token to insert portfolio asset into DB..", async () =>
			{
				await request(app).get("/api/portfolio-asset/create").send({
					load: {
						portfolio_id,
						asset_id,
					} as PortfolioAssetCreate
				}).expect(401);

				const [results]: MySQLQueryResult = await mySQLPool.promise().query("SELECT * FROM portfolio_asset;");

				if (!Array.isArray(results))
				{
					throw new Error("Expected result is not Array");
				}

				expect(results.length).toBe(0);
			});

			test("Should fail if no portfolio_id passed..", async () =>
			{
				const RES = await request(app).get("/api/portfolio-asset/create").set(
					'authorization',
					`Bearer ${token}`
				).send({
					load: {
						asset_id: asset_id,
					}
				}).expect(400);

				expect(RES.text).toBe("No portfolio_id received");

				const [results]: MySQLQueryResult = await mySQLPool.promise().query("SELECT * FROM portfolio_asset;");

				if (!Array.isArray(results))
				{
					throw new Error("Expected result is not Array");
				}

				expect(results.length).toBe(0);
			});

			test("Should fail if no portfolio asset ticker passed..", async () =>
			{
				const RES = await request(app).get("/api/portfolio-asset/create").set(
					'authorization',
					`Bearer ${token}`
				).send({
					load: {
						portfolio_id: portfolio_id,
					}
				}).expect(400);

				expect(RES.text).toBe("No asset_id received");

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
			test("Should insert portfolio asset into database..", async () =>
			{
				const RES_PORTFOLIO_ASSET = await request(app).get("/api/portfolio-asset/create").set(
					'authorization',
					`Bearer ${token}`
				).send({
					load: {
						portfolio_id: portfolio_id,
						asset_id: asset_id,
					} as PortfolioAssetCreate
				});

				expect(RES_PORTFOLIO_ASSET.statusCode).toBe(201);

				const [portfolioAssests]: MySQLQueryResult = await mySQLPool.promise().query("SELECT * FROM portfolio_asset;");

				if (!Array.isArray(portfolioAssests))
				{
					throw new Error("Expected result is not Array");
				}

				expect(portfolioAssests.length).toBeGreaterThan(0);

				if (!("asset_id" in portfolioAssests[0]))
				{
					throw new Error("Key 'asset_id' not in portfolioAssets");
				}

				expect(portfolioAssests[0].asset_id).toBe(asset_id);

				if (!("portfolio_id" in portfolioAssests[0]))
				{
					throw new Error("Key 'portfolio_id' not in portfolioAssets");
				}

				expect(portfolioAssests[0].portfolio_id).toBe(portfolio_id);
			});
		});
	});
});
