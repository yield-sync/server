import express from "express";
import mysql from "mysql";
import request from "supertest";

import routeApiPortfolioAsset from "./index";
import routeApi from "../index";
import routeApiPortfolio from "../portfolio/index";
import routeApiUser from "../user/index";
import config from "../../../config";
import DBBuilder, { dropDB } from "../../../sql/DBBuilder";


const DB_NAME: string = "mock_db_portfolio_asset";
const EMAIL: string = "testemail@example.com";
const PASSWORD: string = "testpassword!";
const PORTFOLIO_NAME: string = "my-portfolio";
const TICKER: string = "PS";

let token: string;
let portfolio_id: string;
let app: express.Express;
let dBConnection: mysql.Connection;


beforeAll(async () =>
{
	// [mysql] Database connection configuration
	dBConnection = mysql.createConnection({
		host: config.app.database.host,
		user: config.app.database.user,
		password: config.app.database.password,
	});

	// [mysql] Open connection
	dBConnection.connect((error: Error) =>
	{
		if (error)
		{
			throw new Error(error.stack);
		}
	});

	// [mock-db] drop and recreate
	await DBBuilder(dBConnection, DB_NAME, true);

	// [mysql] Select the recreated database
	dBConnection.changeUser(
	{ database: DB_NAME },
	(error: Error) =>
	{
		if (error)
		{
			throw new Error(`DB Change User Error: ${error.stack}`);
		}
	});

	app = express().use(express.json()).use("/api", routeApi()).use("/api/user", routeApiUser(dBConnection)).use(
		"/api/portfolio",
		routeApiPortfolio(dBConnection)
	).use(
		"/api/portfolio-asset",
		routeApiPortfolioAsset(dBConnection)
	);
});

afterAll(async () =>
{
	// Drop the database
	dropDB(DB_NAME, dBConnection);

	// [mysql] Close connection
	dBConnection.end();
});

beforeEach(async () =>
{
	// Drop the database
	dropDB(DB_NAME, dBConnection);

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

	const results: [{ id: string }] = await new Promise((resolve, reject) => {
		dBConnection.query("SELECT id FROM portfolio WHERE name = ?;", [PORTFOLIO_NAME], (error, results) => {
			if (error) {
				reject(error);
			} else {
				resolve(results);
			}
		});
	});

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

			dBConnection.query(
				"SELECT * FROM portfolio_asset;",
				async (error, results) =>
				{
					if (error)
					{
						throw new Error(error.stack);
					}

					expect(results.length).toBe(0);
				}
			);
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

			dBConnection.query(
				"SELECT * FROM portfolio_asset;",
				async (error, results) =>
				{
					if (error)
					{
						throw new Error(error.stack);
					}

					expect(results.length).toBe(0);
				}
			);
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

				dBConnection.query(
					"SELECT * FROM portfolio_asset;",
					async (error, results) =>
					{
						if (error)
						{
							throw new Error(error.stack);
						}

						expect(results.length).toBe(0);
					}
				);
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

			dBConnection.query(
				"SELECT * FROM portfolio_asset;",
				async (error, results) =>
				{
					if (error)
					{
						throw new Error(error.stack);
					}

					expect(results.length).toBeGreaterThan(0);

					expect(results[0].ticker).toBe(TICKER);
				}
			);
		});
	});
});
