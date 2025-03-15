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


		it("Should return 400 for an invalid query..", async () => {
			const res = await request(app).get("/api/stock/search/QUERY").set("authorization", `Bearer ${token}`);

			expect(res.statusCode).toBe(400);
		});

		it("Should update stock if ISIN remains the same but symbol changes..", async () => {
			// Mock the external API response
			(axios.get as jest.Mock).mockResolvedValueOnce({
				data: [{
					symbol: ticker,
					companyName: companyName,
					exchangeShortName: exchange,
					isin: isin
				}]
			});

			await mySQLPool.promise().query(
				"UPDATE stock SET symbol = ?, name = ? WHERE isin = ?;",
				[
					'OLD',
					'Old Name',
					isin
				]
			);

			const res = await request(app).get("/api/stock/search/AAPL").set("authorization", `Bearer ${token}`);

			expect(res.statusCode).toBe(202);

			const updatedStock = await mySQLPool.promise().query<IStock>("SELECT * FROM stock WHERE isin = ?;", [isin]);

			expect(updatedStock[0].symbol).toBe(ticker);

			expect(updatedStock[0].name).toBe(companyName);

			expect(updatedStock[0].isin).toBe(isin);

			expect(updatedStock[0].exchange).toBe(exchange);
		});

		it("Should return stock from DB if it exists and NOT make external request..", async () => {
			const fiveDaysAfter = new Date((new Date()).getTime() + 5 * 24 * 60 * 60 * 1000);

			// Add a last_refresh_timestamp so far in the future that the external request cannot trigger
			await mySQLPool.promise().query(
				`
					INSERT INTO
						query_stock (query, last_refresh_timestamp)
					VALUES
						(?, ?)
					ON DUPLICATE KEY UPDATE
						last_refresh_timestamp = ?
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
				refreshRequired: false,
				stocks: [{
					id: 1,
					symbol: ticker,
					name: companyName,
					exchange: exchange,
					isin: isin,
				}],
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
				refreshRequired: true,
				stocks: [{
					id: 1,
					symbol: ticker,
					name: companyName,
					exchange: exchange,
					isin: isin
				}],
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
	describe("Route: /api/stock/delete", () =>
	{
		describe("Expected Failure", () =>
		{
			it("[auth] Should require a user token..", async () =>
			{
				await request(app).post("/api/stock/delete").send().expect(401);
			});

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
				await mySQLPool.promise().query(
					"INSERT INTO stock (symbol, name, exchange, isin) VALUES (?, ?, ?, ?);",
					[
						ASSET_SYMBOL,
						ASSET_NAME,
						"nasdaq",
						"US0378331005",
					]
				);

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
