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

	app = express().use(express.json()).use("/api", routeApi()).use("/api/user", routeApiUser(mySQLPool)).use(
		"/api/asset",
		routeAPIAsset(mySQLPool)
	);
});

beforeEach(async () =>
{
	await dropDB(DB_NAME, mySQLPool);

	await DBBuilder(mySQLPool, DB_NAME, true);

	await request(app).post("/api/user/create").send({
		load: {
			email: EMAIL,
			password: PASSWORD
		} as UserCreate
	}).expect(201);

	const resLogin = await request(app).post("/api/user/login").send({
		load: {
			email: EMAIL,
			password: PASSWORD
		} as UserLogin
	}).expect(200);

	token = (JSON.parse(resLogin.text)).token;

	expect(typeof token).toBe("string");
});


describe("Request: GET", () =>
{
	describe("Route: /api/asset/create", () =>
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
