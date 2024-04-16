import express from "express";
import mysql from "mysql";
import request from "supertest";
import { promisify } from "util";

import routeApiPortfolio from "./index";
import routeApi from "../index";
import routeApiUser from "../user/index";
import config from "../../../config";
import DBBuilder, { dropDB } from "../../../sql/DBBuilder";


const DB_NAME: string = "mock_db_portfolio";
const EMAIL: string = "testemail@example.com";
const PASSWORD: string = "testpassword!";
const PORTFOLIO_NAME: string = "my-portfolio";

let dBQuery;
let token: string;

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
	// Promisify dbConnection.query for easier use with async/await
	dBQuery = promisify(dBConnection.query).bind(dBConnection);

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

			const results = await dBQuery("SELECT * FROM portfolio;");

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

			const results = await dBQuery("SELECT * FROM portfolio;");

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

			const results = await dBQuery("SELECT * FROM portfolio;");

			expect(results.length).toBeGreaterThan(0);

			expect(results[0].name).toBe(PORTFOLIO_NAME);
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

				const results = await dBQuery("SELECT * FROM portfolio;");

				expect(results.length).toBeGreaterThan(0);

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

				const resultsAfter = await dBQuery("SELECT * FROM portfolio;");

				expect(resultsAfter.length).toBe(0);
			});
	});
});
