import express from "express";
import mysql from "mysql2";
import request from "supertest";

import routeAPICryptocurrency from "./index";
import routeApi from "../index";
import routeApiUser from "../user/index";
import config from "../../../config";
import externalAPI from "../../../external-api/coingecko";
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


jest.mock("../../../external-api/coingecko", () => ({ queryForCryptocurrency: jest.fn(), }));

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

	jest.clearAllMocks()
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

		describe("Expected Success", () => {
			const QUERY = "USD";


			it("Should return up to 10 database results without external call..", async () => {
				const fiveDaysAfter = new Date((new Date()).getTime() + 5 * 24 * 60 * 60 * 1000);

				// Add a last_refresh_timestamp so far in the future that the external request cannot trigger
				await mySQLPool.promise().query(
					`
						INSERT INTO
							query_cryptocurrency (query, last_refresh_timestamp)
						VALUES
							(?, ?)
						ON DUPLICATE KEY UPDATE
							last_refresh_timestamp = ?
						;
					`,
					[QUERY, fiveDaysAfter, fiveDaysAfter]
				);

				// Insert 15 cryptocurrencies that have sumbol of USD into the DB
				for (let i = 0; i < 15; i++)
				{
					await mySQLPool.promise().query(
						"INSERT INTO cryptocurrency (symbol, name, coingecko_id) VALUES (?, ?, ?);",
						[QUERY, `US Dollar ${i}`, `usdc-${i}`]
					);
				}

				const res = await request(app).get(`/api/cryptocurrency/search/${QUERY}`).set(
					"authorization",
					`Bearer ${token}`
				).expect(200);

				expect(res.body.externalRequestRequired).toBeFalsy();

				// Capped at 10
				expect(res.body.cryptocurrencies).toHaveLength(10);

				// No external call yet
				expect(res.body.externalAPIResults).toHaveLength(0);

				expect(res.body.cryptocurrencies.every((c: ICryptocurrency) => c.symbol.includes(QUERY))).toBe(true);
			});

			it("Should call external API and sync new results, still capping at 10..", async () => {
				// Mock external API response
				(externalAPI.queryForCryptocurrency as jest.Mock).mockResolvedValueOnce([
					{ id: "usdc-1", symbol: QUERY, name: "US Dollar 1" },
					{ id: "usdc-2", symbol: QUERY, name: "US Dollar 2" },
				]);

				expect(externalAPI.queryForCryptocurrency).toHaveBeenCalledTimes(0);

				// Insert some initial data
				await mySQLPool.promise().query(
					"INSERT INTO cryptocurrency (symbol, name, coingecko_id) VALUES (?, ?, ?);",
					["USD", "US Dollar 0", "usdc-0"]
				);

				const res = await request(app).get(`/api/cryptocurrency/search/${QUERY}`).set(
					"authorization",
					`Bearer ${token}`
				).expect(200);

				expect(res.body.externalRequestRequired).toBeTruthy();

				// Initial 1 + 2 new, but should cap at 10 if more
				expect(res.body.cryptocurrencies).toHaveLength(3);

				// Full external response
				expect(res.body.externalAPIResults).toHaveLength(2);

				expect(externalAPI.queryForCryptocurrency).toHaveBeenCalledWith(QUERY);

				// Check database sync
				const [dbCryptos] = await mySQLPool.promise().query<ICryptocurrency[]>(
					"SELECT * FROM cryptocurrency;"
				);

				// 1 initial + 2 synced
				expect(dbCryptos.length).toBe(3);

				expect(dbCryptos.some((c) => c.coingecko_id === "usdc-1")).toBe(true);

				expect(dbCryptos.some((c) => c.coingecko_id === "usdc-2")).toBe(true);
			});

			it("Should respect external API delay and return only DB results..", async () => {
				// Mock external API response
				(externalAPI.queryForCryptocurrency as jest.Mock).mockResolvedValueOnce([
					{ id: "usdc-1", symbol: QUERY, name: "US Dollar 1" },
					{ id: "usdc-2", symbol: QUERY, name: "US Dollar 2" },
				]);

				expect(externalAPI.queryForCryptocurrency).toHaveBeenCalledTimes(0);

				// First call: triggers external API
				const res = await request(app).get(`/api/cryptocurrency/search/${QUERY}`).set(
					"authorization",
					`Bearer ${token}`
				).expect(200);

				expect(res.body.externalRequestRequired).toBeTruthy();

				expect(externalAPI.queryForCryptocurrency).toHaveBeenCalledTimes(1);

				// Second call: within 1440 minutes, should not call external API again
				const res2 = await request(app).get(`/api/cryptocurrency/search/${QUERY}`).set(
					"authorization",
					`Bearer ${token}`
				).expect(200);

				expect(res2.body.externalRequestRequired).toBeFalsy();

				// Still capped
				expect(res2.body.cryptocurrencies.length).toBeLessThanOrEqual(10);

				// No external call
				expect(res2.body.externalAPIResults).toHaveLength(0);

				// Only called once
				expect(externalAPI.queryForCryptocurrency).toHaveBeenCalledTimes(1);
			});

			it("Should return empty arrays if no matches found..", async () => {
				// Mock external API to return empty array
				(externalAPI.queryForCryptocurrency as jest.Mock).mockResolvedValueOnce([]);

				const res = await request(app).get(`/api/cryptocurrency/search/${QUERY}`).set(
					"authorization",
					`Bearer ${token}`
				).expect(200);

				expect(res.body.externalRequestRequired).toBeTruthy();

				expect(res.body.cryptocurrencies).toHaveLength(0);

				expect(res.body.externalAPIResults).toHaveLength(0);
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
			beforeEach(async () => {
				await mySQLPool.promise().query(
					"INSERT INTO cryptocurrency (symbol, name, coingecko_id) VALUES (?, ?, ?);",
					[
						ASSET_SYMBOL,
						ASSET_NAME,
						COINGECKO_ID,
					]
				);
			});


			it("Should update asset name successfully", async () =>
			{
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
		beforeEach(async () => {
			await mySQLPool.promise().query(
				"INSERT INTO cryptocurrency (symbol, name, coingecko_id) VALUES (?, ?, ?);",
				[
					ASSET_SYMBOL,
					ASSET_NAME,
					COINGECKO_ID,
				]
			);
		});


		it("Should delete asset successfully", async () =>
		{
			let cryptos;

			[cryptos] = await mySQLPool.promise().query(
				"SELECT * FROM cryptocurrency WHERE coingecko_id = ?;",
				[COINGECKO_ID]
			);

			let id = cryptos[0].id;
		});
	});
});
