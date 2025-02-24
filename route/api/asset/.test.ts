import express from "express";
import mysql from "mysql2";
import request from "supertest";

import routeAPIAsset from "./index";
import routeApi from "../index";
import routeApiUser from "../user/index";
import config from "../../../config";
import DBBuilder, { dropDB } from "../../../sql/db-builder";

const ASSET_NAME = "Asset";
const ASSET_SYMBOL = "A";
const DB_NAME = "mock_db_asset";
const EMAIL = "testemail@example.com";
const PASSWORD = "testpassword!";

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

	// Promote user to admin
	await mySQLPool.promise().query("UPDATE user SET admin = b'1' WHERE email = ?;", [EMAIL]);

	const resLogin = await request(app).post("/api/user/login").send({
		load: {
			email: EMAIL,
			password: PASSWORD
		} as UserLogin
	}).expect(200);

	token = JSON.parse(resLogin.text).token;

	expect(typeof token).toBe("string");
});


describe("Request: POST", () =>
{
	describe("Route: /api/asset/create", () =>
	{
		describe("Expected Failure", () =>
		{
			it("[auth] Should require a user token.", async () =>
			{
				await request(app).post("/api/asset/create").send().expect(401);

				const [assets]: any[] = await mySQLPool.promise().query("SELECT * FROM asset;");

				expect(Array.isArray(assets)).toBe(true);

				expect(assets.length).toBe(0);
			});

			it("Should fail if required fields are missing..", async () =>
			{
				// Missing network
				await request(app).post("/api/asset/create").set("authorization", `Bearer ${token}`).send({
					load: { name: ASSET_NAME, symbol: ASSET_SYMBOL }
				}).expect(400);
			});

			it("Should fail if ISIN is missing for a stock asset..", async () =>
			{
				await request(app).post("/api/asset/create").set("authorization", `Bearer ${token}`).send({
					load: { name: ASSET_NAME, symbol: ASSET_SYMBOL, network: "nasdaq" }
				}).expect(400);
			});

			it("Should fail if address is missing for a crypto asset..", async () =>
			{
				await request(app).post("/api/asset/create").set("authorization", `Bearer ${token}`).send({
					load: { name: ASSET_NAME, symbol: ASSET_SYMBOL, network: "ethereum" }
				}).expect(400);
			});
		});

		describe("Expected Success", () =>
		{
			it("Should create a stock asset..", async () =>
			{
				const res = await request(app).post("/api/asset/create").set("authorization", `Bearer ${token}`).send({
					load: { name: ASSET_NAME, symbol: ASSET_SYMBOL, network: "nasdaq", isin: "US0378331005" }
				});

				expect(res.statusCode).toBe(201);

				const [assets]: any[] = await mySQLPool.promise().query(
					"SELECT * FROM asset WHERE isin = ?;",
					["US0378331005"]
				);

				expect(Array.isArray(assets)).toBe(true);

				expect(assets.length).toBe(1);

				expect(assets[0].network).toBe("nasdaq");

				expect(assets[0].isin).toBe("US0378331005");
			});

			it("Should create a crypto asset..", async () =>
			{
				const res = await request(app).post("/api/asset/create").set("authorization", `Bearer ${token}`).send({
					load: { name: ASSET_NAME, symbol: ASSET_SYMBOL, network: "ethereum", address: "0xabcdef123456" }
				});

				expect(res.statusCode).toBe(201);

				const [assets]: any[] = await mySQLPool.promise().query("SELECT * FROM asset WHERE address = ?;", ["0xabcdef123456"]);

				expect(Array.isArray(assets)).toBe(true);

				expect(assets.length).toBe(1);

				expect(assets[0].network).toBe("ethereum");

				expect(assets[0].address).toBe("0xabcdef123456");
			});
		});
	});

	describe("Route: /api/asset/update", () =>
	{
		describe("Expected Failure", () =>
		{
			it("[auth] Should require a user token..", async () =>
			{
				await request(app).post("/api/asset/update").send().expect(401);
			});
		});
	});

	describe("Route: /api/asset/delete", () =>
	{
		describe("Expected Failure", () =>
		{
			it("[auth] Should require a user token..", async () =>
			{
				await request(app).post("/api/asset/delete").send().expect(401);
			});
		});
	});
});
