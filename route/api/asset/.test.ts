import express from "express";
import mysql from "mysql2";
import request from "supertest";

import routeAPIAsset from "./index";
import routeApi from "../index";
import routeApiUser from "../user/index";
import config from "../../../config";
import DBBuilder, { dropDB } from "../../../sql/db-builder";


const DB_NAME: string = "mock_db_asset";
const EMAIL: string = "testemail@example.com";
const PASSWORD: string = "testpassword!";
const PORTFOLIO_NAME: string = "my-portfolio";

let token: string;

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
		"/api/asset",
		routeAPIAsset(dBConnection)
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

			const [results]: MySQLQueryResult = await dBConnection.promise().query("SELECT * FROM asset;");

			if (!Array.isArray(results))
			{
				throw new Error("Expected result is not Array");
			}

			expect(results.length).toBe(0);
		});
	});
});
