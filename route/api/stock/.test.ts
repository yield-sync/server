import axios from "axios";
import express from "express";
import mysql from "mysql2";
import request from "supertest";

import routeAPIAsset from "./index";
import routeApi from "../index";
import routeApiUser from "../user/index";
import config from "../../../config";
import DBBuilder, { dBDrop } from "../../../sql/db-builder";

const ASSET_NAME = "Asset";
const ASSET_SYMBOL = "A";
const DB_NAME = "mock_db_stock";
const EMAIL = "testemail@example.com";
const PASSWORD = "testpassword!";

let token: string;

let app: express.Express;
let mySQLPool: mysql.Pool;


jest.mock("axios");


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
		"/api/stock",
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


describe("Request: GET", () => {
	describe("/api/stock/search/:query", () => {
		const ticker = "AAPL";
		const companyName = "Apple Inc.";
		const exchange = "nasdaq";
		const isin = "US0378331005";


		afterEach(() => {
			jest.clearAllMocks();
		});


		it("Should return stock from DB if it exists and NOT make external request..", async () => {
			const fiveDaysAfter = new Date((new Date()).getTime() + 5 * 24 * 60 * 60 * 1000);

			// Add a last_request_timestamp so far in the future that the external request cannot trigger
			await mySQLPool.promise().query(
				`
					INSERT INTO
						query_stock (query, last_request_timestamp)
					VALUES
						(?, ?)
					ON DUPLICATE KEY UPDATE
						last_request_timestamp = ?
					;
				`,
				[ticker, fiveDaysAfter, fiveDaysAfter]
			);

			await mySQLPool.promise().query(
				"INSERT INTO stock (symbol, name, exchange, isin) VALUES (?, ?, ?, ?);",
				[
					ticker,
					companyName,
					exchange,
					isin,
				]
			);

			const res = await request(app).get(`/api/stock/search/${ticker}`).set("authorization", `Bearer ${token}`);

			expect(res.statusCode).toBe(202);

			expect(res.body).toEqual({
				externalRequestRequired: false,
				stocks: [{
					id: 1,
					symbol: ticker,
					name: companyName,
					exchange: exchange,
					isin: isin
				}],
				externalAPIResults: [
				],
			});

			expect(axios.get).not.toHaveBeenCalled();
		});

		it("Should fetch from external API if stock does not exist in DB..", async () => {
			// Mock the external API response
			(axios.get as jest.Mock).mockResolvedValueOnce({
				data: [{
					symbol: ticker,
					companyName: companyName,
					exchangeShortName: exchange,
					isin: isin
				}]
			});

			const res = await request(app).get(`/api/stock/search/${ticker}`).set("authorization", `Bearer ${token}`);

			expect(res.statusCode).toBe(202);

			expect(res.body).toEqual({
				externalRequestRequired: true,
				stocks: [{
					id: 1,
					symbol: ticker,
					name: companyName,
					exchange: exchange,
					isin: isin
				}],
				externalAPIResults: [{
					symbol: ticker,
					companyName: companyName,
					exchangeShortName: exchange,
					isin: isin
				}]
			});

			const { uRL, key, } = config.api.financialModelingPrep;

			expect(axios.get).toHaveBeenCalledWith(
				expect.stringContaining(`${uRL}/api/v3/profile/${ticker}?apikey=${key}`)
			);
		});
	});
});

describe("Request: POST", () =>
{
	describe("Route: /api/stock/create", () =>
	{
		describe("Expected Failure", () =>
		{
			it("[auth] Should require a user token..", async () =>
			{
				await request(app).post("/api/stock/create").send().expect(401);

				const [stocks]: any[] = await mySQLPool.promise().query("SELECT * FROM stock;");

				expect(Array.isArray(stocks)).toBe(true);

				expect(stocks.length).toBe(0);
			});

			it("Should fail if exchange is missing..", async () =>
			{
				const res = await request(app).post("/api/stock/create").set("authorization", `Bearer ${token}`).send({
					load: { name: ASSET_NAME, symbol: ASSET_SYMBOL }
				});

				expect(res.statusCode).toBe(400);

				expect(res.text).toBe("Invalid or missing exchange");
			});


			it("Should fail if ISIN is missing..", async () =>
			{
				const res = await request(app).post("/api/stock/create").set("authorization", `Bearer ${token}`).send({
					load: { name: ASSET_NAME, symbol: ASSET_SYMBOL, exchange: "nasdaq" }
				});

				expect(res.statusCode).toBe(400);

				expect(res.text).toBe("ISIN is required for stock");
			});
		});

		describe("Expected Success", () =>
		{
			it("Should create stock..", async () =>
			{
				const res = await request(app).post("/api/stock/create").set("authorization", `Bearer ${token}`).send({
					load: { name: ASSET_NAME, symbol: ASSET_SYMBOL, exchange: "nasdaq", isin: "US0378331005" }
				});

				expect(res.statusCode).toBe(201);

				const [assets]: any[] = await mySQLPool.promise().query(
					"SELECT * FROM stock WHERE isin = ?;",
					["US0378331005"]
				);

				expect(Array.isArray(assets)).toBe(true);

				expect(assets.length).toBe(1);

				expect(assets[0].exchange).toBe("nasdaq");

				expect(assets[0].isin).toBe("US0378331005");
			});
		});

		describe("Expected Failure Part 2", () =>
			{
				it("Should not allow dulicate ISINs to exist..", async () =>
				{
					await request(app).post("/api/stock/create").set("authorization", `Bearer ${token}`).send({
						load: { name: ASSET_NAME, symbol: ASSET_SYMBOL, exchange: "nasdaq", isin: "US0378331005" }
					});

					const res = await request(app).post("/api/stock/create").set("authorization", `Bearer ${token}`).send({
						load: { name: ASSET_NAME, symbol: ASSET_SYMBOL, exchange: "nasdaq", isin: "US0378331005" }
					});

					expect(res.statusCode).toBe(409);

					expect(res.text).toBe("ISIN already exists");
				});
			});
	});

	describe("Route: /api/stock/update", () =>
	{
		describe("Expected Failure", () =>
		{
			it("[auth] Should require a user token..", async () =>
			{
				await request(app).post("/api/stock/update").send().expect(401);
			});
		});
	});

	describe("Route: /api/stock/delete", () =>
	{
		describe("Expected Failure", () =>
		{
			it("[auth] Should require a user token..", async () =>
			{
				await request(app).post("/api/stock/delete").send().expect(401);
			});
		});
	});

	describe("Route: /api/stock/update", () =>
	{
		describe("Expected Failure", () =>
		{
			it("Should fail if stock_id is missing..", async () =>
			{
				const res = await request(app).post("/api/stock/update").set("authorization", `Bearer ${token}`).send({
					load: { exchange: "nasdaq", isin: "US0378331005", name: ASSET_NAME, symbol: ASSET_SYMBOL }
				});

				expect(res.statusCode).toBe(400);
				expect(res.text).toBe("stock_id is required");
			});
		});

		describe("Expected Success", () =>
		{
			it("Should update stock..", async () =>
			{
				const createRes = await request(app).post("/api/stock/create").set("authorization", `Bearer ${token}`).send({
					load: { name: ASSET_NAME, symbol: ASSET_SYMBOL, exchange: "nasdaq", isin: "US0378331005" }
				});

				expect(createRes.statusCode).toBe(201);

				const [assets]: any[] = await mySQLPool.promise().query(
					"SELECT * FROM stock WHERE isin = ?;",
					["US0378331005"]
				);

				expect(assets.length).toBe(1);

				const updateRes = await request(app).post("/api/stock/update").set("authorization", `Bearer ${token}`).send({
					load: { stock_id: assets[0].id, name: "New Name", symbol: "NEW", exchange: "nasdaq", isin: "US0378331005" }
				});

				expect(updateRes.statusCode).toBe(200);
				expect(updateRes.text).toBe("Updated stock");

				const [updated]: any[] = await mySQLPool.promise().query("SELECT * FROM stock WHERE id = ?;", [assets[0].id]);

				expect(updated[0].name).toBe("New Name");
				expect(updated[0].symbol).toBe("NEW");
			});
		});
	});

	describe("Route: /api/stock/delete", () =>
	{
		describe("Expected Failure", () =>
		{
			it("Should fail if stock_id is missing..", async () =>
			{
				const res = await request(app).post("/api/stock/delete").set("authorization", `Bearer ${token}`).send({
					load: {}
				});

				expect(res.statusCode).toBe(400);
				expect(res.text).toBe("Stock ID is required");
			});
		});

		describe("Expected Success", () =>
		{
			it("Should delete stock..", async () =>
			{
				const createRes = await request(app).post("/api/stock/create").set("authorization", `Bearer ${token}`).send({
					load: { name: ASSET_NAME, symbol: ASSET_SYMBOL, exchange: "nasdaq", isin: "US0378331005" }
				});

				expect(createRes.statusCode).toBe(201);

				const [assets]: any[] = await mySQLPool.promise().query("SELECT * FROM stock;");

				expect(assets.length).toBe(1);

				const deleteRes = await request(app).post("/api/stock/delete").set("authorization", `Bearer ${token}`).send({
					load: { stock_id: assets[0].id }
				});

				expect(deleteRes.statusCode).toBe(200);
				expect(deleteRes.text).toBe("Deleted stock");

				const [deleted]: any[] = await mySQLPool.promise().query("SELECT * FROM stock;");

				expect(deleted.length).toBe(0);
			});
		});
	});
});
