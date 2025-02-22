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
		"/api/asset",
		routeAPIAsset(mySQLPool)
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

			const [results]: MySQLQueryResult = await mySQLPool.promise().query("SELECT * FROM asset;");

			if (!Array.isArray(results))
			{
				throw new Error("Expected result is not Array");
			}

			expect(results.length).toBe(0);
		});
	});
});
