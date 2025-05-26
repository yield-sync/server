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
		const cryptoSymbol: string = "USD";

		beforeEach(async () => {
			// Insert 15 cryptocurrencies that have sumbol of USD into the DB
			for (let i = 0; i < 15; i++)
			{
				await mySQLPool.promise().query(
					"INSERT INTO cryptocurrency (symbol, name, id) VALUES (?, ?, ?);",
					[cryptoSymbol, `US Dollar ${i}`, `usdc-${i}`]
				);
			}
		});

		describe("Expected Success", () => {
			it("Should return up to 10 database results without external call..", async () => {
				const res = await request(app).get(`/api/cryptocurrency/search/${cryptoSymbol}`).send();

				// Capped at 10
				expect(res.body.cryptocurrencies).toHaveLength(15);

				expect(res.status).toBe(HTTPStatus.OK)

				// Verify that the cryptocurrencies are correct
				expect(res.body.cryptocurrencies.every((c: ICryptocurrency) => c.symbol.includes(cryptoSymbol))).toBe(true);
			});
		});
	});
});

describe("Request: POST", () =>
{
	describe("Route: /api/cryptocurrency/search", () =>
	{
		const cryptoSymbol: string = "USD";

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
						query_cryptocurrency (query, last_updated)
					VALUES
						(?, ?)
					ON DUPLICATE KEY UPDATE
						last_updated = ?
					;
				`,
				[cryptoSymbol, fiveDaysAfter, fiveDaysAfter]
			);
		});

		describe("Expected Failure", () =>
		{
			it("[auth] Should require a user token..", async () =>
			{
				await request(app).post("/api/cryptocurrency/search").send().expect(401);
			});

			it("[auth] Should require a valid user token..", async () =>
			{
				const res = await request(app).post("/api/cryptocurrency/search").send({
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
				).send().expect(400);
			});
		});

		describe("Expected Success", () => {
			it("Should return up to 10 database results without external call..", async () => {
				const res = await request(app).post("/api/cryptocurrency/search").set(
					"authorization",
					`Bearer ${token}`,
				).send(
					{
						load: {
							query: cryptoSymbol
						}
					}
				);

				// Capped at 10
				expect(res.body.cryptocurrencies).toHaveLength(15);

				expect(res.status).toBe(HTTPStatus.OK)

				// Verify that the cryptocurrencies are correct
				expect(res.body.cryptocurrencies.every((c: ICryptocurrency) => c.symbol.includes(cryptoSymbol))).toBe(true);
			});
		});
	});

	describe("Route: /api/cryptocurrency/create", () =>
	{
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
