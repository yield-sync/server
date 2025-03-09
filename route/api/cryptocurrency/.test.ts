import express from "express";
import mysql from "mysql2";
import request from "supertest";

import routeAPICryptocurrency from "./index";
import routeApi from "../index";
import routeApiUser from "../user/index";
import config from "../../../config";
import DBBuilder, { dBDrop } from "../../../sql/db-builder";

const ASSET_NAME = "US Dollar Coin";
const ASSET_SYMBOL = "USDC";
const DB_NAME = "mock_db_crypto";
const EMAIL = "testemail@example.com";
const PASSWORD = "testpassword!";
const COINGECKO_ID = "usdc";

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
		"/api/cryptocurrency",
		routeAPICryptocurrency(mySQLPool)
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


describe("Request: GET", () =>
{
	describe("Route: /api/cryptocurrency/search/:query", () =>
	{
		describe("Expected Failure", () =>
		{
			it("[auth] Should require a user token..", async () =>
			{
				await request(app).get("/api/cryptocurrency/search/query").send().expect(401);
			});

			it("Should fail if coingecko_id is missing.", async () =>
			{
				await request(app).post("/api/cryptocurrency/create").set("authorization", `Bearer ${token}`).send({
					load: { name: ASSET_NAME, symbol: ASSET_SYMBOL } as CryptocurrencyCreate
				}).expect(400);
			});
		});
	});
});

describe("Request: POST", () =>
{
	describe("Route: /api/cryptocurrency/create", () =>
	{
		describe("Expected Failure", () =>
		{
			it("[auth] Should require a user token..", async () =>
			{
				await request(app).post("/api/cryptocurrency/create").send().expect(401);

				const [cryptos]: any[] = await mySQLPool.promise().query("SELECT * FROM cryptocurrency;");

				expect(Array.isArray(cryptos)).toBe(true);

				expect(cryptos.length).toBe(0);
			});

			it("Should fail if coingecko_id is missing.", async () =>
			{
				await request(app).post("/api/cryptocurrency/create").set("authorization", `Bearer ${token}`).send({
					load: { name: ASSET_NAME, symbol: ASSET_SYMBOL } as CryptocurrencyCreate
				}).expect(400);
			});
		});

		describe("Expected Success", () =>
		{
			it("Should create asset.", async () =>
			{
				const res = await request(app).post("/api/cryptocurrency/create").set("authorization", `Bearer ${token}`).send({
					load: { name: ASSET_NAME, symbol: ASSET_SYMBOL, coingecko_id: COINGECKO_ID } as CryptocurrencyCreate
				});

				expect(res.statusCode).toBe(201);

				const [cryptos]: any[] = await mySQLPool.promise().query("SELECT * FROM cryptocurrency WHERE coingecko_id = ?;", [COINGECKO_ID]);

				expect(Array.isArray(cryptos)).toBe(true);
				expect(cryptos.length).toBe(1);
				expect(cryptos[0].coingecko_id).toBe(COINGECKO_ID);
			});
		});

		describe("Expected Failure Part 2", () =>
		{
			it("Should not allow duplicate coingecko_id.", async () =>
			{
				await request(app).post("/api/cryptocurrency/create").set("authorization", `Bearer ${token}`).send({
					load: { name: ASSET_NAME, symbol: ASSET_SYMBOL, coingecko_id: COINGECKO_ID } as CryptocurrencyCreate
				});

				const res = await request(app).post("/api/cryptocurrency/create").set("authorization", `Bearer ${token}`).send({
					load: { name: ASSET_NAME, symbol: ASSET_SYMBOL, coingecko_id: COINGECKO_ID } as CryptocurrencyCreate
				});

				expect(res.statusCode).toBe(409);
				expect(res.error.text).toBe("coingecko_id already found");
			});
		});
	});
});

describe("Request: PUT", () =>
{
	describe("Expected Success", () =>
	{
		describe("Route: /api/cryptocurrency/update", () =>
		{
			it("Should update asset name successfully", async () =>
			{
				await request(app).post("/api/cryptocurrency/create").set("authorization", `Bearer ${token}`).send({
					load: { name: ASSET_NAME, symbol: ASSET_SYMBOL, coingecko_id: COINGECKO_ID } as CryptocurrencyCreate
				});

				let cryptos;

				[cryptos] = await mySQLPool.promise().query(
					"SELECT * FROM cryptocurrency WHERE coingecko_id = ?;",
					[COINGECKO_ID]
				);

				let id = cryptos[0].id;

				const newName = "Updated Coin";

				const res = await request(app).put(`/api/cryptocurrency/update/${id}`).set(
					"authorization",
					`Bearer ${token}`
				).send({
					load: { name: newName } as CryptocurrencyUpdate
				});

				expect(res.statusCode).toBe(200);

				[cryptos] = await mySQLPool.promise().query(
					"SELECT * FROM cryptocurrency WHERE coingecko_id = ?;",
					[COINGECKO_ID]
			);
				expect(cryptos[0].name).toBe(newName);
			});
		});
	});
});

describe("Request: DELETE", () =>
{
	describe("Route: /api/cryptocurrency/delete", () =>
	{
		it("Should delete asset successfully", async () =>
		{
			await request(app).post("/api/cryptocurrency/create").set("authorization", `Bearer ${token}`).send({
				load: { name: ASSET_NAME, symbol: ASSET_SYMBOL, coingecko_id: COINGECKO_ID } as CryptocurrencyCreate
			});

			let cryptos;

			[cryptos] = await mySQLPool.promise().query(
				"SELECT * FROM cryptocurrency WHERE coingecko_id = ?;",
				[COINGECKO_ID]
			);

			let id = cryptos[0].id;
		});
	});
});
