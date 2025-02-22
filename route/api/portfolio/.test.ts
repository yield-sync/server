import express from "express";
import mysql from "mysql2";
import request from "supertest";

import routeApiPortfolio from "./index";
import routeApi from "../index";
import routeApiUser from "../user/index";
import config from "../../../config";
import DBBuilder, { dropDB } from "../../../sql/db-builder";


const DB_NAME: string = "mock_db_portfolio";
const EMAIL: string = "testemail@example.com";
const PASSWORD: string = "testpassword!";
const PORTFOLIO_NAME: string = "my-portfolio";

let token: string;

let app: express.Express;
let mySQLPool: mysql.Pool;


afterAll(async () =>
{
	// Drop the database (should await)
	await dropDB(DB_NAME, mySQLPool);

	// Close connection (should await)
	await mySQLPool.end();
});

beforeAll(async () =>
{
	// [mysql] Database connection configuration
	mySQLPool = mysql.createPool({
		host: config.app.database.host,
		user: config.app.database.user,
		password: config.app.database.password,
		waitForConnections: true,
		connectionLimit: 10,
		queueLimit: 0
	});

	// [mysql] Connect
	await mySQLPool.promise().getConnection();

	// [mock-db] drop and recreate
	await DBBuilder(mySQLPool, DB_NAME, true);

	// [mysql] Select the recreated database
	await mySQLPool.promise().query("USE ??;", [DB_NAME]);

	app = express().use(express.json()).use("/api", routeApi()).use("/api/user", routeApiUser(mySQLPool)).use(
		"/api/portfolio",
		routeApiPortfolio(mySQLPool)
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
	const RES_LOGIN = await request(app).post("/api/user/login").send({
		load: {
			email: EMAIL,
			password: PASSWORD
		}
	}).expect(200);

	token = (JSON.parse(RES_LOGIN.text)).token;

	expect(typeof token).toBe("string");
});


// [test]
describe("ROUTE: /api/portfolio", () =>
{
	describe("GET /create", () =>
	{
		test("[auth] Should require a user token to insert portfolio into DB..", async () =>
		{
			await request(app).get("/api/portfolio/create").send({
				load: {
					portfolio: {
						name: PORTFOLIO_NAME
					}
				}
			}).expect(401);

			const [results]: MySQLQueryResult = await mySQLPool.promise().query("SELECT * FROM portfolio;");

			if (!Array.isArray(results))
			{
				throw new Error("Expected result is not Array");
			}

			expect(Array.isArray(results)).toBe(true);

			expect(results.length).toBe(0);
		});

		test("Should fail if no portfolio name passed..", async () =>
		{
			const RES = await request(app).get("/api/portfolio/create").set(
				'tokenuser',
				`Bearer ${token}`
			).send({
				load: {
					portfolio: {
						name: undefined
					}
				}
			}).expect(400);

			expect(RES.text).toBe("No portfolio name provided");

			const [results]: MySQLQueryResult = await mySQLPool.promise().query("SELECT * FROM portfolio;");

			if (!Array.isArray(results))
			{
				throw new Error("Expected result is not Array");
			}

			expect(results.length).toBe(0);
		});

		test("Should insert portfolio into database..", async () =>
		{
			const PORTFOLIO_NAME: string = "my-portfolio";

			const RES_PORTFOLIO_CREATE = await request(app).get("/api/portfolio/create").set(
				'tokenuser',
				`Bearer ${token}`
			).send({
				load: {
					portfolio: {
						name: PORTFOLIO_NAME
					}
				}
			});

			expect(RES_PORTFOLIO_CREATE.statusCode).toBe(201);

			const [results]: MySQLQueryResult = await mySQLPool.promise().query("SELECT * FROM portfolio;");

			if (!Array.isArray(results))
			{
				throw new Error("Expected result is not Array");
			}

			expect(results.length).toBeGreaterThan(0);

			if (!("name" in results[0]))
			{
				throw new Error("Expected result is not Array");
			}

			expect(results[0].name).toBe(PORTFOLIO_NAME);
		});
	});

	describe("GET /update", () =>
		{
			test("[auth] Should require a user token to update portfolio into DB..", async () =>
			{
				await request(app).get("/api/portfolio/update").send({
					load: {
						portfolio: {
							name: PORTFOLIO_NAME
						}
					}
				}).expect(401);
			});

			test("Should fail if no portfolio id passed..", async () =>
			{
				const PORTFOLIO_NAME: string = "my-portfolio";

				const RES_PORTFOLIO_CREATE = await request(app).get("/api/portfolio/create").set(
					'tokenuser',
					`Bearer ${token}`
				).send({
					load: {
						portfolio: {
							name: PORTFOLIO_NAME
						}
					}
				});

				expect(RES_PORTFOLIO_CREATE.statusCode).toBe(201);

				const [results]: MySQLQueryResult = await mySQLPool.promise().query("SELECT * FROM portfolio;");

				if (!Array.isArray(results))
				{
					throw new Error("Expected result is not Array");
				}

				expect(results.length).toBeGreaterThan(0);

				if (!("name" in results[0]))
				{
					throw new Error("Expected result is not Array");
				}

				expect(results[0].name).toBe(PORTFOLIO_NAME);

				await request(app).get("/api/portfolio/update").set(
					'tokenuser',
					`Bearer ${token}`
				).send({
					load: {
						portfolio: {
							id: undefined,
							name: undefined
						}
					}
				}).expect(400);

				await request(app).get("/api/portfolio/update").set(
					'tokenuser',
					`Bearer ${token}`
				).send({
					load: {
						portfolio: {
							id: undefined,
							name: "with name"
						}
					}
				}).expect(400);
			});

			test("Should fail if no portfolio name passed..", async () =>
			{
				const PORTFOLIO_NAME: string = "my-portfolio";

				const RES_PORTFOLIO_CREATE = await request(app).get("/api/portfolio/create").set(
					'tokenuser',
					`Bearer ${token}`
				).send({
					load: {
						portfolio: {
							name: PORTFOLIO_NAME
						}
					}
				});

				expect(RES_PORTFOLIO_CREATE.statusCode).toBe(201);

				const [results]: MySQLQueryResult = await mySQLPool.promise().query("SELECT * FROM portfolio;");

				if (!Array.isArray(results))
				{
					throw new Error("Expected result is not Array");
				}

				expect(results.length).toBeGreaterThan(0);

				if (!("name" in results[0]))
				{
					throw new Error("Expected result is not Array");
				}

				expect(results[0].name).toBe(PORTFOLIO_NAME);

				await request(app).get("/api/portfolio/update").set(
					'tokenuser',
					`Bearer ${token}`
				).send({
					load: {
						portfolio: {
							id: results[0].id,
							name: undefined
						}
					}
				}).expect(400);
			});

			test("Should update portfolio into database..", async () =>
			{
				const PORTFOLIO_NAME: string = "my-portfolio";

				const RES_PORTFOLIO_CREATE = await request(app).get("/api/portfolio/create").set(
					'tokenuser',
					`Bearer ${token}`
				).send({
					load: {
						portfolio: {
							name: PORTFOLIO_NAME
						}
					}
				});

				expect(RES_PORTFOLIO_CREATE.statusCode).toBe(201);

				const [results]: MySQLQueryResult = await mySQLPool.promise().query("SELECT * FROM portfolio;");

				if (!Array.isArray(results))
				{
					throw new Error("Expected result is not Array");
				}

				expect(results.length).toBeGreaterThan(0);

				if (!("name" in results[0]))
				{
					throw new Error("Expected result is not Array");
				}

				expect(results[0].name).toBe(PORTFOLIO_NAME);

				const PORTFOLIO_NAME_NEW: string = "new-name"

				const RES_PORTFOLIO_UPDATE = await request(app).get("/api/portfolio/update").set(
					'tokenuser',
					`Bearer ${token}`
				).send({
					load: {
						portfolio: {
							id: results[0].id,
							name: PORTFOLIO_NAME_NEW
						}
					}
				});

				expect(RES_PORTFOLIO_UPDATE.statusCode).toBe(201);

				const [resultsAfter]: MySQLQueryResult = await mySQLPool.promise().query("SELECT * FROM portfolio;");

				if (!Array.isArray(resultsAfter))
				{
					throw new Error("Expected result is not Array");
				}

				expect(resultsAfter.length).toBeGreaterThan(0);

				if (!("name" in resultsAfter[0]))
				{
					throw new Error("Expected result is not Array");
				}

				expect(resultsAfter[0].name).toBe(PORTFOLIO_NAME_NEW);
			});
		});

	describe("GET /", () =>
	{
		test("Should be able to retrieve portfolio(s) from database..", async () =>
		{
			const PORTFOLIO_NAME: string = "my-portfolio";

			const RES_PORTFOLIO_CREATE = await request(app).get("/api/portfolio/create").set(
				'tokenuser',
				`Bearer ${token}`
			).send({
				load: {
					portfolio: {
						name: PORTFOLIO_NAME
					}
				}
			});

			expect(RES_PORTFOLIO_CREATE.statusCode).toBe(201);

			const RES_PORTFOLIO = await request(app).get("/api/portfolio").set('tokenuser', `Bearer ${token}`).send();

			let portfolio: [{ id: string, name: string }] = JSON.parse(RES_PORTFOLIO.text);

			expect(portfolio.length).toBeGreaterThanOrEqual(1);

			expect(portfolio[0].name).toBe(PORTFOLIO_NAME);
		});
	});

	describe("GET /delete", () =>
	{
		test("Should be able to delete portfolio from database..", async () =>
			{
				const PORTFOLIO_NAME: string = "my-portfolio";

				const RES_PORTFOLIO_CREATE = await request(app).get("/api/portfolio/create").set(
					'tokenuser',
					`Bearer ${token}`
				).send({
					load: {
						portfolio: {
							name: PORTFOLIO_NAME
						}
					}
				});

				expect(RES_PORTFOLIO_CREATE.statusCode).toBe(201);

				const RES_PORTFOLIO = await request(app).get("/api/portfolio").set('tokenuser', `Bearer ${token}`).send();

				let portfolio: [{ id: string, name: string }] = JSON.parse(RES_PORTFOLIO.text);

				expect(portfolio.length).toBeGreaterThanOrEqual(1);

				expect(portfolio[0].name).toBe(PORTFOLIO_NAME);

				const [results]: MySQLQueryResult = await mySQLPool.promise().query("SELECT * FROM portfolio;");

				if (!Array.isArray(results))
				{
					throw new Error("Expected result is not Array");
				}


				expect(results.length).toBeGreaterThan(0);

				if (!("name" in results[0]))
				{
					throw new Error("Expected result is not Array");
				}

				expect(results[0].name).toBe(PORTFOLIO_NAME);


				const RES_PORTFOLIO_DELETE = await request(app).get("/api/portfolio/delete").set(
					'tokenuser',
					`Bearer ${token}`
				).send({
					load: {
						portfolio_id: portfolio[0].id
					}
				});

				expect(RES_PORTFOLIO_DELETE.statusCode).toBe(201);

				const [resultsAfter]: MySQLQueryResult = await mySQLPool.promise().query("SELECT * FROM portfolio;");

				if (!Array.isArray(resultsAfter))
				{
					throw new Error("Expected result is not Array");
				}

				expect(resultsAfter.length).toBe(0);
			});
	});
});
