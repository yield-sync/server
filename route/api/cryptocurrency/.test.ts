import express from "express";
import mysql from "mysql2";
import request from "supertest";

import routeAPICryptocurrency from "./index";
import routeApi from "../index";
import routeApiUser from "../user/index";
import config from "../../../config";
import { queryCryptocurrency } from "../../../external-api/coingecko";
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

// Mock the external API
jest.mock("../../../external-api/coingecko", () => ({
	queryCryptocurrency: jest.fn(),
}));

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
	const COINGECKO_ID = "usdc";
	const QUERY = "USD";

	describe("Route: /api/cryptocurrency/search/:query", () =>
	{
		describe("Expected Failure", () =>
		{
			it("[auth] Should require a user token..", async () =>
			{
				await request(app).get("/api/cryptocurrency/search/query").send().expect(401);
			});

			it("Should fail if query is not provided..", async () =>
			{
				await request(app).post("/api/cryptocurrency/search").set(
					"authorization",
					`Bearer ${token}`
				).send().expect(
					404
				);
			});
		});
	});

	describe("Expected Success", () => {
		it("Should return up to 10 database results without external call", async () => {
			// TODO This test is failing because the queryCryptocurrency function is being a jest test and
			// since i havent mocked it here yet i am getting an error
			// Insert 15 cryptocurrencies into the database
			for (let i = 0; i < 15; i++)
			{
				await mySQLPool.promise().query(
					"INSERT INTO cryptocurrency (symbol, name, coingecko_id) VALUES (?, ?, ?);",
					[`USD${i}`, `US Dollar ${i}`, `usdc${i}`]
				);
			}

			const res = await request(app).get(`/api/cryptocurrency/search/${QUERY}`).set(
				"authorization",
				`Bearer ${token}`
			).expect(200);

			// Capped at 10
			expect(res.body.cryptocurrencies).toHaveLength(10);

			// No external call yet
			expect(res.body.externalAPIResults).toHaveLength(0);

			expect(res.body.cryptocurrencies.every((c: ICryptocurrency) => c.symbol.includes(QUERY))).toBe(true);
		});

		it("Should call external API and sync new results, still capping at 10", async () => {
			// Mock external API response
			const mockCoins = [
				{ id: "usdc1", symbol: "USD1", name: "US Dollar 1" },
				{ id: "usdc2", symbol: "USD2", name: "US Dollar 2" },
			];

			(queryCryptocurrency as jest.Mock).mockResolvedValueOnce(mockCoins);

			// Insert some initial data
			await mySQLPool.promise().query(
				"INSERT INTO cryptocurrency (symbol, name, coingecko_id) VALUES (?, ?, ?);",
				["USD0", "US Dollar 0", "usdc0"]
			);

			const res = await request(app)
				.get(`/api/cryptocurrency/search/${QUERY}`)
				.set("authorization", `Bearer ${token}`)
				.expect(200);

			const body = res.body;
			expect(body.cryptocurrencies).toHaveLength(3); // Initial 1 + 2 new, but should cap at 10 if more
			expect(body.externalAPIResults).toHaveLength(2); // Full external response
			expect(queryCryptocurrency).toHaveBeenCalledWith(QUERY);

			// Check database sync
			const [dbCryptos] = await mySQLPool.promise().query<ICryptocurrency[]>(
				"SELECT * FROM cryptocurrency;"
			);
			expect(dbCryptos.length).toBe(3); // 1 initial + 2 synced
			expect(dbCryptos.some((c) => c.coingecko_id === "usdc1")).toBe(true);
			expect(dbCryptos.some((c) => c.coingecko_id === "usdc2")).toBe(true);
		});

		it("Should respect external API delay and return only DB results", async () => {
			// Mock external API response
			const mockCoins = [{ id: "usdc1", symbol: "USD1", name: "US Dollar 1" }];
			(queryCryptocurrency as jest.Mock).mockResolvedValue(mockCoins);

			// First call: triggers external API
			await request(app)
				.get(`/api/cryptocurrency/search/${QUERY}`)
				.set("authorization", `Bearer ${token}`)
				.expect(200);

			// Second call: within 1440 minutes, should not call external API again
			const res = await request(app)
				.get(`/api/cryptocurrency/search/${QUERY}`)
				.set("authorization", `Bearer ${token}`)
				.expect(200);

			const body = res.body;
			expect(body.cryptocurrencies.length).toBeLessThanOrEqual(10); // Still capped
			expect(body.externalAPIResults).toHaveLength(0); // No external call
			expect(queryCryptocurrency).toHaveBeenCalledTimes(1); // Only called once
		});

		it("Should return empty arrays if no matches found", async () => {
			// Mock external API to return empty array
			(queryCryptocurrency as jest.Mock).mockResolvedValueOnce([]);

			const res = await request(app)
				.get(`/api/cryptocurrency/search/NONEXISTENT`)
				.set("authorization", `Bearer ${token}`)
				.expect(200);

			const body = res.body;
			expect(body.cryptocurrencies).toHaveLength(0);
			expect(body.externalAPIResults).toHaveLength(0);
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
