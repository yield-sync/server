import express from "express";
import mysql from "mysql";
import request from "supertest";
import { promisify } from "util";

import routeAPIAsset from "./index";
import routeApi from "../index";
import routeApiUser from "../user/index";
import config from "../../../config";
import DBBuilder, { dropDB } from "../../../sql/DBBuilder";


const DB_NAME: string = "mock_db_asset";
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
		"/api/asset",
		routeAPIAsset(dBConnection)
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
describe("ROUTE: /api/asset", () =>
{
	describe("GET /create", () =>
	{
		test("[auth] Should require a user token insert asset into DB..", async () =>
		{
			await request(app).get("/api/asset/create").send({
				load: {
					asset: {
						name: PORTFOLIO_NAME
					}
				}
			}).expect(401);

			const results = await dBQuery("SELECT * FROM asset;");

			expect(results.length).toBe(0);
		});
	});
});
