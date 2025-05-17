import express from "express";
import mysql from "mysql2";
import request from "supertest";

import routeAPICryptocurrency from "./index";
import routeApi from "../index";
import routeApiUser from "../user/index";
import config from "../../../config";
import { HTTPStatus } from "../../../constants";
import extAPIDataProviderCryptocurrency from "../../../external-api/data-provider-cryptocurrency";
import DBBuilder, { dBDrop } from "../../../sql/db-builder";


const ASSET_NAME = "US Dollar Coin";
const ASSET_SYMBOL = "USDC";
const DB_NAME = "mock_db_crypto";
const EMAIL = "testemail@example.com";
const PASSWORD = "testpassword!";
const ID = "usdc";

let token: string;

let app: express.Express;
let mySQLPool: mysql.Pool;


jest.mock("../../../external-api/data-provider-cryptocurrency", () => ({ queryForCryptocurrency: jest.fn(), }));


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
	}).expect(HTTPStatus.CREATED);

	// Promote user to admin
	await mySQLPool.promise().query("UPDATE user SET admin = b'1' WHERE email = ?;", [EMAIL]);

	const resLogin = await request(app).post("/api/user/login").send({
		load: {
			email: EMAIL,
			password: PASSWORD
		} as UserLogin
	}).expect(HTTPStatus.OK);

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

			it("[auth] Should require a valid user token..", async () =>
			{
				const res = await request(app).get("/api/cryptocurrency/search/query").send({
					token: "invalid.token.value"
				});

				expect(res.statusCode).toBe(401);

				expect(res.body.message).toBe("Access denied: Invalid or missing token");
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
			const cryptoSymbol: string = "USD";

			describe("No external request made", () => {
				beforeEach(async () => {
					// Insert 15 cryptocurrencies that have sumbol of USD into the DB
					for (let i = 0; i < 15; i++)
					{
						await mySQLPool.promise().query(
							"INSERT INTO cryptocurrency (symbol, name, id) VALUES (?, ?, ?);",
							[cryptoSymbol, `US Dollar ${i}`, `usdc-${i}`]
						);
					}

					const fiveDaysAfter = new Date((new Date()).getTime() + 5 * 24 * 60 * 60 * 1000);

					// Add a last_updated so far in the future that the external request cannot trigger
					await mySQLPool.promise().query(
						`
							INSERT INTO
								profile_cryptocurrency (query, last_updated)
							VALUES
								(?, ?)
							ON DUPLICATE KEY UPDATE
								last_updated = ?
							;
						`,
						[cryptoSymbol, fiveDaysAfter, fiveDaysAfter]
					);
				});

				it("Should return up to 10 database results without external call..", async () => {
					const res = await request(app).get(`/api/cryptocurrency/search/${cryptoSymbol}`).set(
						"authorization",
						`Bearer ${token}`
					).expect(HTTPStatus.OK);

					// Verify that the external request was NOT made
					expect(res.body.externalRequestRequired).toBeFalsy();

					// Capped at 10
					expect(res.body.cryptocurrencies).toHaveLength(10);

					// No external call yet
					expect(res.body.externalAPIResults).toHaveLength(0);

					// Verify that the cryptocurrencies are correct
					expect(res.body.cryptocurrencies.every((c: ICryptocurrency) => c.symbol.includes(cryptoSymbol))).toBe(true);
				});
			});

			describe("External request made", () => {
				describe("Valid external request made", () => {
					beforeEach(async () => {
						// Mock external API response
						(extAPIDataProviderCryptocurrency.queryForCryptocurrency as jest.Mock).mockResolvedValueOnce([
							{ id: "usdc-1", symbol: cryptoSymbol, name: "US Dollar 1" },
							{ id: "usdc-2", symbol: cryptoSymbol, name: "US Dollar 2" },
						]);
					});


					it("Should call external API and sync new results, still capping at 10..", async () => {
						expect(extAPIDataProviderCryptocurrency.queryForCryptocurrency).toHaveBeenCalledTimes(0);

						// Insert some initial data
						await mySQLPool.promise().query(
							"INSERT INTO cryptocurrency (symbol, name, id) VALUES (?, ?, ?);",
							["USD", "US Dollar 0", "usdc-0"]
						);

						const res = await request(app).get(`/api/cryptocurrency/search/${cryptoSymbol}`).set(
							"authorization",
							`Bearer ${token}`
						).expect(HTTPStatus.OK);

						expect(res.body.externalRequestRequired).toBeTruthy();

						// Initial 1 + 2 new, but should cap at 10 if more
						expect(res.body.cryptocurrencies).toHaveLength(3);

						// Full external response
						expect(res.body.externalAPIResults).toHaveLength(2);

						expect(extAPIDataProviderCryptocurrency.queryForCryptocurrency).toHaveBeenCalledWith(cryptoSymbol);

						// Check database sync
						const [dbCryptos] = await mySQLPool.promise().query<ICryptocurrency[]>(
							"SELECT * FROM cryptocurrency;"
						);

						// 1 initial + 2 synced
						expect(dbCryptos.length).toBe(3);

						expect(dbCryptos.some((c) => c.id === "usdc-1")).toBe(true);

						expect(dbCryptos.some((c) => c.id === "usdc-2")).toBe(true);
					});

					it("Should respect external API delay and return only DB results..", async () => {
						expect(extAPIDataProviderCryptocurrency.queryForCryptocurrency).toHaveBeenCalledTimes(0);

						// First call: triggers external API
						const res = await request(app).get(`/api/cryptocurrency/search/${cryptoSymbol}`).set(
							"authorization",
							`Bearer ${token}`
						).expect(HTTPStatus.OK);

						expect(res.body.externalRequestRequired).toBeTruthy();

						expect(extAPIDataProviderCryptocurrency.queryForCryptocurrency).toHaveBeenCalledTimes(1);

						// Second call: within 1440 minutes, should not call external API again
						const res2 = await request(app).get(`/api/cryptocurrency/search/${cryptoSymbol}`).set(
							"authorization",
							`Bearer ${token}`
						).expect(HTTPStatus.OK);

						expect(res2.body.externalRequestRequired).toBeFalsy();

						// Still capped
						expect(res2.body.cryptocurrencies.length).toBeLessThanOrEqual(10);

						// No external call
						expect(res2.body.externalAPIResults).toHaveLength(0);

						// Only called once
						expect(extAPIDataProviderCryptocurrency.queryForCryptocurrency).toHaveBeenCalledTimes(1);
					});
				});

				describe("Invalid external request made", () => {
					it("Should return empty arrays if no matches found..", async () => {
						// Mock external API to return empty array
						(extAPIDataProviderCryptocurrency.queryForCryptocurrency as jest.Mock).mockResolvedValueOnce([]);

						const res = await request(app).get(`/api/cryptocurrency/search/${cryptoSymbol}`).set(
							"authorization",
							`Bearer ${token}`
						).expect(HTTPStatus.OK);

						expect(res.body.externalRequestRequired).toBeTruthy();

						expect(res.body.cryptocurrencies).toHaveLength(0);

						expect(res.body.externalAPIResults).toHaveLength(0);
					});
				});
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
					"INSERT INTO cryptocurrency (symbol, name, id) VALUES (?, ?, ?);",
					[
						ASSET_SYMBOL,
						ASSET_NAME,
						ID,
					]
				);
			});


			it("Should update asset name successfully", async () =>
			{
				let cryptos;

				[cryptos] = await mySQLPool.promise().query(
					"SELECT * FROM cryptocurrency WHERE id = ?;",
					[ID]
				);

				let id = cryptos[0].id;

				const newName = "Updated Coin";

				const res = await request(app).put(`/api/cryptocurrency/update/${id}`).set(
					"authorization",
					`Bearer ${token}`
				).send({
					load: { name: newName } as CryptocurrencyUpdate
				});

				expect(res.statusCode).toBe(HTTPStatus.OK);

				[cryptos] = await mySQLPool.promise().query(
					"SELECT * FROM cryptocurrency WHERE id = ?;",
					[ID]
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
				"INSERT INTO cryptocurrency (symbol, name, id) VALUES (?, ?, ?);",
				[
					ASSET_SYMBOL,
					ASSET_NAME,
					ID,
				]
			);
		});


		it("Should delete asset successfully", async () =>
		{
			let cryptos;

			[cryptos] = await mySQLPool.promise().query(
				"SELECT * FROM cryptocurrency WHERE id = ?;",
				[ID]
			);

			let id = cryptos[0].id;
		});
	});
});

afterAll(async () =>
{
	await dBDrop(DB_NAME, mySQLPool);
	await mySQLPool.end();
});
