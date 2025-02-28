import express from "express";
import mysql from "mysql2";
import request from "supertest";

import routeAPIAsset from "./index";
import routeApi from "../index";
import routeApiUser from "../user/index";
import config from "../../../config";
import DBBuilder, { dBDrop } from "../../../sql/db-builder";

const ASSET_NAME = "US Dollar Coin";
const ASSET_SYMBOL = "USDC";
const DB_NAME = "mock_db_crypto";
const EMAIL = "testemail@example.com";
const PASSWORD = "testpassword!";

let token: string;

let app: express.Express;
let mySQLPool: mysql.Pool;


afterAll(async () =>
{
	await dBDrop(DB_NAME, mySQLPool);
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
		"/api/crypto",
		routeAPIAsset(mySQLPool)
	);
});

beforeEach(async () =>
{
	await dBDrop(DB_NAME, mySQLPool);

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
	describe("Route: /api/crypto/create", () =>
	{
		describe("Expected Failure", () =>
		{
			it("[auth] Should require a user token.", async () =>
			{
				await request(app).post("/api/crypto/create").send().expect(401);

				const [assets]: any[] = await mySQLPool.promise().query("SELECT * FROM crypto;");

				expect(Array.isArray(assets)).toBe(true);

				expect(assets.length).toBe(0);
			});

			it("Should fail if network is missing..", async () =>
			{
				// Missing network
				await request(app).post("/api/crypto/create").set("authorization", `Bearer ${token}`).send({
					load: { name: ASSET_NAME, symbol: ASSET_SYMBOL }
				}).expect(400);
			});

			it("Should fail if address is missing..", async () =>
			{
				await request(app).post("/api/crypto/create").set("authorization", `Bearer ${token}`).send({
					load: { name: ASSET_NAME, symbol: ASSET_SYMBOL, network: "ethereum" }
				}).expect(400);
			});
		});

		describe("Expected Success", () =>
		{
			it("Should create asset..", async () =>
			{
				const res = await request(app).post("/api/crypto/create").set("authorization", `Bearer ${token}`).send({
					load: { name: ASSET_NAME, symbol: ASSET_SYMBOL, network: "ethereum", address: "0xabcdef123456" }
				});

				expect(res.statusCode).toBe(201);

				const [assets]: any[] = await mySQLPool.promise().query("SELECT * FROM crypto WHERE address = ?;", ["0xabcdef123456"]);

				expect(Array.isArray(assets)).toBe(true);

				expect(assets.length).toBe(1);

				expect(assets[0].network).toBe("ethereum");

				expect(assets[0].address).toBe("0xabcdef123456");
			});
		});

		describe("Expected Failure Part 2", () =>
		{
			it("Should not allow duplciate addresses on an network..", async () =>
			{
				await request(app).post("/api/crypto/create").set("authorization", `Bearer ${token}`).send({
					load: { name: ASSET_NAME, symbol: ASSET_SYMBOL, network: "ethereum", address: "0xabcdef123456" }
				});

				const res = await request(app).post("/api/crypto/create").set("authorization", `Bearer ${token}`).send({
					load: { name: ASSET_NAME, symbol: ASSET_SYMBOL, network: "ethereum", address: "0xabcdef123456" }
				});

				expect(res.statusCode).toBe(409);

				expect(res.error.text).toBe("Address on blockchain already exists");
			});
		});
	});
});
