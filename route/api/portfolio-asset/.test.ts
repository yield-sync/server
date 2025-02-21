import express from "express";
import mysql from "mysql2";

import routeApiPortfolioAsset from "./index";
import routeApi from "../index";
import routeApiPortfolio from "../portfolio/index";
import routeApiUser from "../user/index";
import config from "../../../config";
import DBBuilder, { dropDB } from "../../../sql/DBBuilder";


const request = require('supertest');


const DB_NAME: string = "mock_db_portfolio_asset";
const EMAIL: string = "testemail@example.com";
const PASSWORD: string = "testpassword!";
const PORTFOLIO_NAME: string = "my-portfolio";
const TICKER: string = "PS";

let token: string;
let portfolio_id: string;
let app: express.Express;
let dBConnection: mysql.Pool;


afterAll(async () =>
{
	// Drop the database (should await)
	await dropDB(DB_NAME, dBConnection);

	// Close connection (should await)
	await dBConnection.end();
});

beforeAll(async () =>
{
// [mysql] Database connection configuration
	dBConnection = mysql.createPool({
		host: config.app.database.host,
		user: config.app.database.user,
		password: config.app.database.password,
		waitForConnections: true,
		connectionLimit: 10,
		queueLimit: 0
	});

	// [mysql] Connect
	await dBConnection.promise().getConnection();

	// [mock-db] drop and recreate
	await DBBuilder(dBConnection, DB_NAME, true);

	// [mysql] Select the recreated database
	await dBConnection.promise().query(`USE ??;`, [DB_NAME]);

	app = express().use(express.json()).use("/api", routeApi()).use("/api/user", routeApiUser(dBConnection)).use(
		"/api/portfolio",
		routeApiPortfolio(dBConnection)
	).use(
		"/api/portfolio-asset",
		routeApiPortfolioAsset(dBConnection)
	);
});

beforeEach(async () =>
{
	// Drop the database
	await dropDB(DB_NAME, dBConnection);

	// [mock-db] drop and recreate
	await DBBuilder(dBConnection, DB_NAME, true);

	// Create a user
	await request(app).post("/api/user/create").send({
		load: {
			email: EMAIL,
			password: PASSWORD
		}
	}).expect(201);

	// Send a login request
	const RES_LOGIN = await request(app).post("/api/user/login").send({
		load: {
			email: EMAIL,
			password: PASSWORD
		}
	}).expect(200);

	token = (JSON.parse(RES_LOGIN.text)).token;

	expect(typeof token).toBe("string");

	// Create a portfolio
	const RES_PORTFOLIO_CREATE = await request(app).get("/api/portfolio/create").set('tokenuser', `Bearer ${token}`).send({
		load: {
			portfolio: {
				name: PORTFOLIO_NAME
			}
		}
	});

	expect(RES_PORTFOLIO_CREATE.statusCode).toBe(201);

	const [results]: MySQLQueryResult = await dBConnection.promise().query(
		"SELECT id FROM portfolio WHERE name = ?;", [PORTFOLIO_NAME]
	);

	portfolio_id = results[0].id;
});


describe("ROUTE: /api/portfolio-asset", () =>
{
	describe("GET /", () =>
	{
		test("[auth] Should require a user token to insert portfolio asset into DB..", async () =>
		{
			await request(app).get("/api/portfolio-asset/create").send({
				load: {
					portfolio: {
						portfolio_id: portfolio_id,
						ticker: TICKER
					}
				}
			}).expect(401);

			const [results]: MySQLQueryResult = await dBConnection.promise().query("SELECT * FROM portfolio_asset;");

			if (!Array.isArray(results))
			{
				throw new Error("Expected result is not Array");
			}

			expect(results.length).toBe(0);
		});

		test("Should fail if no portfolio id passed..", async () =>
		{
			const RES = await request(app).get("/api/portfolio-asset/create").set(
				'tokenuser',
				`Bearer ${token}`
			).send({
				load: {
					portfolio_id: undefined,
					ticker: TICKER
				}
			}).expect(400);

			expect(RES.text).toBe("No portfolio id received");

			const [results]: MySQLQueryResult = await dBConnection.promise().query("SELECT * FROM portfolio_asset;");

			if (!Array.isArray(results))
			{
				throw new Error("Expected result is not Array");
			}

			expect(results.length).toBe(0);
		});

		test("Should fail if no portfolio asset ticker passed..", async () =>
			{
				const RES = await request(app).get("/api/portfolio-asset/create").set(
					'tokenuser',
					`Bearer ${token}`
				).send({
					load: {
						portfolio_id: portfolio_id,
						ticker: undefined
					}
				}).expect(400);

				expect(RES.text).toBe("No portfolio asset ticker received");

				const [results]: MySQLQueryResult = await dBConnection.promise().query("SELECT * FROM portfolio_asset;");

				if (!Array.isArray(results))
				{
					throw new Error("Expected result is not Array");
				}

				expect(results.length).toBe(0);
			});

		test("Should insert portfolio asset into database..", async () =>
		{
			const RES_PORTFOLIO_ASSET = await request(app).get("/api/portfolio-asset/create").set(
				'tokenuser',
				`Bearer ${token}`
			).send({
				load: {
					portfolio_id: portfolio_id,
					ticker: TICKER
				}
			});

			expect(RES_PORTFOLIO_ASSET.statusCode).toBe(201);

			const [results]: MySQLQueryResult = await dBConnection.promise().query("SELECT * FROM portfolio_asset;");

			if (!Array.isArray(results))
			{
				throw new Error("Expected result is not Array");
			}

			expect(results.length).toBeGreaterThan(0);

			if (!("ticker" in results[0]))
			{
				throw new Error("Expected result is not Array");
			}

			expect(results[0].ticker).toBe(TICKER);
		});
	});
});
