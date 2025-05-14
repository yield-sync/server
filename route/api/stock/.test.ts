// test/integration/stock-api.test.ts
import express from "express";
import mysql from "mysql2";
import request from "supertest";

// Routes
import routeAPIAsset from "./index";
import routeApi from "../index";
import routeApiUser from "../user/index";

// Config and Utilities
import config from "../../../config";
import { HTTPStatus } from "../../../constants";
import extAPIDataProviderStock from "../../../external-api/data-provider-stock";
import DBBuilder, { dBDrop } from "../../../sql/db-builder";


// Test Setup
let app: express.Express;
let mySQLPool: mysql.Pool;
let token: string;

jest.mock("axios");
jest.mock("../../../external-api/data-provider-stock", () => ({
	getStockProfileByIsin: jest.fn(),
	getStockProfileBySymbol: jest.fn(),
	queryForStockByIsin: jest.fn(),
	queryForStockBySymbol: jest.fn(),
}));


const CONSTANTS = {
	DB_NAME: "test_db_stock",
	USER: {
		EMAIL: "testemail@example.com",
		PASSWORD: "testpassword!"
	},
	STOCKS: {
		APPLE: {
			SYMBOL: "AAPL",
			NAME: "Apple Inc.",
			EXCHANGE: "nasdaq",
			ISIN: "US0378331005",
			SECTOR: "Technology",
			INDUSTRY: "Consumer Electronics",
		},
		BANANA: {
			SYMBOL: "BANANA",
			NAME: "Banana Inc.",
			EXCHANGE: "nasdaq",
			ISIN: "abcdef123456",
			SECTOR: "Technology",
			INDUSTRY: "Consumer Electronics",
		},
	}
};


const insertStock = async (
	symbol: string,
	name: string,
	exchange: string,
	isin: string,
	sector: string,
	industry: string,
	updatedOn: Date = new Date()
) => {
	await mySQLPool.promise().query(
		"INSERT INTO stock (symbol, name, exchange, isin, sector, industry, updated_on) VALUES (?, ?, ?, ?, ?, ?, ?);",
		[symbol, name, exchange, isin, sector, industry, updatedOn]
	);
};

const setQueryTimestamp = async (query: string, timestamp: Date) => {
	await mySQLPool.promise().query(
		`
			INSERT INTO profile_stock (query, last_updated)
			VALUES (?, ?)
			ON DUPLICATE KEY UPDATE last_updated = ?;
		`,
		[query, timestamp, timestamp]
	);
};

// Test Suites
beforeAll(async () => {
	mySQLPool = mysql.createPool({
		host: config.app.database.host,
		user: config.app.database.user,
		password: config.app.database.password,
		waitForConnections: true,
		connectionLimit: 10,
		queueLimit: 0
	});

	await mySQLPool.promise().getConnection();

	await DBBuilder(mySQLPool, CONSTANTS.DB_NAME, true);

	await mySQLPool.promise().query("USE ??;", [CONSTANTS.DB_NAME]);

	app = express().use(express.json()).use("/api", routeApi()).use("/api/user", routeApiUser(mySQLPool)).use(
		"/api/stock",
		routeAPIAsset(mySQLPool)
	);
});

beforeEach(async () => {
	await dBDrop(CONSTANTS.DB_NAME, mySQLPool);
	await DBBuilder(mySQLPool, CONSTANTS.DB_NAME, true);

	await request(app).post("/api/user/create").send({
		load: {
			email: CONSTANTS.USER.EMAIL,
			password: CONSTANTS.USER.PASSWORD
		}
	}).expect(HTTPStatus.CREATED);

	await mySQLPool.promise().query("UPDATE user SET admin = b'1' WHERE email = ?;", [CONSTANTS.USER.EMAIL]);

	const resLogin = await request(app).post("/api/user/login").send({
		load: { email: CONSTANTS.USER.EMAIL, password: CONSTANTS.USER.PASSWORD }
	}).expect(HTTPStatus.OK);

	token = JSON.parse(resLogin.text).token;

	expect(typeof token).toBe("string");
});


describe("Request: GET", () => {
	describe("/api/stock/read/:symbol", () => {
		afterEach(() => jest.clearAllMocks());

		describe("Expected Failure", () => {
			it("Should return 400 for an invalid query..", async () => {
				const res = await request(app).get("/api/stock/read/isin").set("authorization", `Bearer ${token}`);

				expect(res.statusCode).toBe(HTTPStatus.BAD_REQUEST);
			});
		});

		describe("Expected Success", () => {
			it("Should return stock from DB if it exists and NOT make external request..", async () => {
				const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

				await setQueryTimestamp(CONSTANTS.STOCKS.APPLE.SYMBOL, futureDate);

				await insertStock(
					CONSTANTS.STOCKS.APPLE.SYMBOL,
					CONSTANTS.STOCKS.APPLE.NAME,
					CONSTANTS.STOCKS.APPLE.EXCHANGE,
					CONSTANTS.STOCKS.APPLE.ISIN,
					CONSTANTS.STOCKS.APPLE.SECTOR,
					CONSTANTS.STOCKS.APPLE.INDUSTRY,
					futureDate,
				);

				const res = await request(app).get(`/api/stock/read/${CONSTANTS.STOCKS.APPLE.ISIN}`).set(
					"authorization",
					`Bearer ${token}`
				);

				expect(res.statusCode).toBe(HTTPStatus.OK);

				expect(res.body).toEqual({
					UpdateStockPerformed: false,
					dBStockWithExSymbolFound: false,
					stock: {
						symbol: CONSTANTS.STOCKS.APPLE.SYMBOL,
						name: CONSTANTS.STOCKS.APPLE.NAME,
						exchange: CONSTANTS.STOCKS.APPLE.EXCHANGE,
						isin: CONSTANTS.STOCKS.APPLE.ISIN,
						sector: CONSTANTS.STOCKS.APPLE.SECTOR,
						industry: CONSTANTS.STOCKS.APPLE.INDUSTRY,
						updated_on: expect.any(String),
					}
				});

				expect(extAPIDataProviderStock.queryForStockBySymbol).not.toHaveBeenCalled();
			});
		});

		describe("Stock Update Cases", () => {
			beforeEach(async () => {
				await insertStock(
					CONSTANTS.STOCKS.APPLE.SYMBOL,
					CONSTANTS.STOCKS.APPLE.NAME,
					CONSTANTS.STOCKS.APPLE.EXCHANGE,
					CONSTANTS.STOCKS.APPLE.ISIN,
					CONSTANTS.STOCKS.APPLE.SECTOR,
					CONSTANTS.STOCKS.APPLE.INDUSTRY,
				);

				await insertStock(
					CONSTANTS.STOCKS.BANANA.SYMBOL,
					CONSTANTS.STOCKS.BANANA.NAME,
					CONSTANTS.STOCKS.BANANA.EXCHANGE,
					CONSTANTS.STOCKS.BANANA.ISIN,
					CONSTANTS.STOCKS.BANANA.SECTOR,
					CONSTANTS.STOCKS.BANANA.INDUSTRY,
				);
			});

			it("Should Update a stock when the stock.updated_on is old..", async () => {
				const pastDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

				// Add a last_updated so far in the future that the external request cannot trigger
				await mySQLPool.promise().query(
					"UPDATE stock SET updated_on = ? WHERE isin = ?;",
					[pastDate, CONSTANTS.STOCKS.APPLE.ISIN,]
				);

				// Mock the external API response
				(extAPIDataProviderStock.getStockProfileByIsin as jest.Mock).mockResolvedValue({
					symbol: CONSTANTS.STOCKS.APPLE.SYMBOL,
					name: CONSTANTS.STOCKS.APPLE.NAME,
					exchange: CONSTANTS.STOCKS.APPLE.EXCHANGE,
					isin: CONSTANTS.STOCKS.APPLE.ISIN,
					sector: CONSTANTS.STOCKS.APPLE.SECTOR,
					industry: CONSTANTS.STOCKS.APPLE.INDUSTRY,
				});

				const res = await request(app).get(`/api/stock/read/${CONSTANTS.STOCKS.APPLE.ISIN}`).set(
					"authorization",
					`Bearer ${token}`
				);

				expect(res.status).toBe(HTTPStatus.OK);

				expect(res.body.UpdateStockPerformed).toBeTruthy();

				expect(extAPIDataProviderStock.getStockProfileByIsin).toHaveBeenCalledTimes(1);
			});

			it("Should update stock name and symbol if ISIN found already in DB..", async () => {
				const pastDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

				await mySQLPool.promise().query(
					"UPDATE stock SET symbol = ?, name = ?, updated_on = ? WHERE isin = ?;",
					[
						"FB",
						"Facebook Inc.",
						pastDate,
						CONSTANTS.STOCKS.APPLE.ISIN,
					]
				);

				// Mock the external API response
				(extAPIDataProviderStock.getStockProfileByIsin as jest.Mock).mockResolvedValueOnce({
					symbol: CONSTANTS.STOCKS.APPLE.SYMBOL,
					name: CONSTANTS.STOCKS.APPLE.NAME,
					exchange: CONSTANTS.STOCKS.APPLE.EXCHANGE,
					isin: CONSTANTS.STOCKS.APPLE.ISIN,
					sector: CONSTANTS.STOCKS.APPLE.SECTOR,
					industry: CONSTANTS.STOCKS.APPLE.INDUSTRY,
				});

				const readRes = await request(app).get(`/api/stock/read/${CONSTANTS.STOCKS.APPLE.ISIN}`).set(
					"authorization",
					`Bearer ${token}`
				);

				expect(readRes.status).toBe(HTTPStatus.OK);

				expect(readRes.body.dBStockWithExSymbolFound).toBe(false);

				expect(extAPIDataProviderStock.getStockProfileByIsin).toHaveBeenCalledTimes(1);

				const [updatedStock] = await mySQLPool.promise().query<IStock>(
					"SELECT * FROM stock WHERE isin = ?;",
					[CONSTANTS.STOCKS.APPLE.ISIN,]
				);

				expect(updatedStock[0].symbol).toBe(CONSTANTS.STOCKS.APPLE.SYMBOL);

				expect(updatedStock[0].name).toBe(CONSTANTS.STOCKS.APPLE.NAME);

				expect(updatedStock[0].isin).toBe(CONSTANTS.STOCKS.APPLE.ISIN);

				expect(updatedStock[0].sector).toBe(CONSTANTS.STOCKS.APPLE.SECTOR);

				expect(updatedStock[0].industry).toBe(CONSTANTS.STOCKS.APPLE.INDUSTRY);

				expect(updatedStock[0].industry).toBe(CONSTANTS.STOCKS.APPLE.INDUSTRY);
			});

			it("Should create a new stock under the symbol that belonged to a previous stock..", async () => {
				/**
				* @dev Criteria for This Edgecase to Occur
				* 2 companies decide to swap their names and symbols. Now they trade under what was the once the others
				* name and symbol.
				*/

				const pastDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

				await mySQLPool.promise().query(
					"UPDATE stock SET updated_on = ? WHERE isin = ?;",
					[
						pastDate,
						CONSTANTS.STOCKS.APPLE.ISIN,
					]
				);

				// Mock the external API response
				(extAPIDataProviderStock.getStockProfileByIsin as jest.Mock).mockResolvedValue({
					isin: CONSTANTS.STOCKS.APPLE.ISIN,
					symbol: CONSTANTS.STOCKS.BANANA.SYMBOL,
					name: CONSTANTS.STOCKS.BANANA.NAME,
					exchange: CONSTANTS.STOCKS.APPLE.EXCHANGE,
					sector: CONSTANTS.STOCKS.APPLE.SECTOR,
					industry: CONSTANTS.STOCKS.APPLE.INDUSTRY,
				});

				// Mock external API response
				(extAPIDataProviderStock.queryForStockByIsin as jest.Mock).mockResolvedValue({
					isin: CONSTANTS.STOCKS.BANANA.ISIN,
					symbol: CONSTANTS.STOCKS.APPLE.SYMBOL,
					name: CONSTANTS.STOCKS.APPLE.NAME,
					exchange: CONSTANTS.STOCKS.APPLE.EXCHANGE,
					sector: CONSTANTS.STOCKS.APPLE.SECTOR,
					industry: CONSTANTS.STOCKS.APPLE.INDUSTRY,
				});

				const response = await request(app).get(
					`/api/stock/read/${CONSTANTS.STOCKS.APPLE.ISIN}`
				).set("authorization", `Bearer ${token}`);

				expect(response.status).toBe(HTTPStatus.OK);

				expect(extAPIDataProviderStock.getStockProfileByIsin).toHaveBeenCalledTimes(1);

				expect(extAPIDataProviderStock.queryForStockByIsin).toHaveBeenCalledTimes(1);

				const [formallyAppleIncStock] = await mySQLPool.promise().query<IStock>(
					"SELECT * FROM stock WHERE isin = ?;",
					[CONSTANTS.STOCKS.APPLE.ISIN,]
				);

				expect(formallyAppleIncStock[0].symbol).toBe(CONSTANTS.STOCKS.BANANA.SYMBOL);

				expect(formallyAppleIncStock[0].name).toBe(CONSTANTS.STOCKS.BANANA.NAME);

				expect(formallyAppleIncStock[0].sector).toBe(CONSTANTS.STOCKS.BANANA.SECTOR);

				expect(formallyAppleIncStock[0].industry).toBe(CONSTANTS.STOCKS.BANANA.INDUSTRY);

				const [formallyBananaIncStock] = await mySQLPool.promise().query<IStock>(
					"SELECT * FROM stock WHERE isin = ?;",
					[CONSTANTS.STOCKS.BANANA.ISIN]
				);

				expect(formallyBananaIncStock[0].symbol).toBe(CONSTANTS.STOCKS.APPLE.SYMBOL);

				expect(formallyBananaIncStock[0].name).toBe(CONSTANTS.STOCKS.APPLE.NAME);

				expect(formallyBananaIncStock[0].sector).toBe(CONSTANTS.STOCKS.APPLE.SECTOR);

				expect(formallyBananaIncStock[0].industry).toBe(CONSTANTS.STOCKS.APPLE.INDUSTRY);
			});

			it("Should update the symbol and name of an EXISTING stock with an isin equal to the externally received isin..", async () => {
				/**
				* @dev Criteria for This Edgecase to Occur
				* 1) Apple Inc. decides to change their name to Banana Inc.
				* 2) Banana Inc. decides to change their name to Orange Inc.
				*/

				const pastDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

				await mySQLPool.promise().query(
					"UPDATE stock SET updated_on = ? WHERE isin = ?;",
					[
						pastDate,
						CONSTANTS.STOCKS.APPLE.ISIN,
					]
				);

				// Mock the external API response
				(extAPIDataProviderStock.getStockProfileByIsin as jest.Mock).mockResolvedValue({
					isin: CONSTANTS.STOCKS.APPLE.ISIN,
					symbol: CONSTANTS.STOCKS.BANANA.SYMBOL,
					name: CONSTANTS.STOCKS.BANANA.NAME,
					exchange: CONSTANTS.STOCKS.BANANA.EXCHANGE,
					sector: CONSTANTS.STOCKS.BANANA.SECTOR,
					industry: CONSTANTS.STOCKS.BANANA.INDUSTRY,
				});

				const oranceIncName = "Orange Inc.";
				const oranceIncSymbol = "ORANGE";
				const oranceIncSector = "Technology";
				const oranceIncIndustry = "Consumer Electronics";

				// Mock external API response
				(extAPIDataProviderStock.queryForStockByIsin as jest.Mock).mockResolvedValue({
					isin: CONSTANTS.STOCKS.BANANA.ISIN,
					symbol: oranceIncSymbol,
					name: oranceIncName,
					exchange: CONSTANTS.STOCKS.APPLE.EXCHANGE,
					sector: CONSTANTS.STOCKS.BANANA.SECTOR,
					industry: CONSTANTS.STOCKS.BANANA.INDUSTRY,
				});

				await request(app).get(`/api/stock/read/${CONSTANTS.STOCKS.APPLE.ISIN}`).set(
					"authorization",
					`Bearer ${token}`
				).expect(
					200
				);

				expect(extAPIDataProviderStock.getStockProfileByIsin).toHaveBeenCalledTimes(1);

				expect(extAPIDataProviderStock.queryForStockByIsin).toHaveBeenCalledTimes(1);

				const [formallyAppleIncStock] = await mySQLPool.promise().query<IStock>(
					"SELECT * FROM stock WHERE symbol = ?;",
					[CONSTANTS.STOCKS.BANANA.SYMBOL]
				);

				expect(formallyAppleIncStock[0].isin).toBe(CONSTANTS.STOCKS.APPLE.ISIN,);

				expect(formallyAppleIncStock[0].symbol).toBe(CONSTANTS.STOCKS.BANANA.SYMBOL);

				expect(formallyAppleIncStock[0].name).toBe(CONSTANTS.STOCKS.BANANA.NAME);

				expect(formallyAppleIncStock[0].sector).toBe(CONSTANTS.STOCKS.BANANA.SECTOR);

				expect(formallyAppleIncStock[0].industry).toBe(CONSTANTS.STOCKS.BANANA.INDUSTRY);

				const [formallyBananaIncStock] = await mySQLPool.promise().query<IStock>(
					"SELECT * FROM stock WHERE isin = ?;",
					[CONSTANTS.STOCKS.BANANA.ISIN]
				);

				expect(formallyBananaIncStock[0].isin).toBe(CONSTANTS.STOCKS.BANANA.ISIN);

				expect(formallyBananaIncStock[0].symbol).toBe(oranceIncSymbol);

				expect(formallyBananaIncStock[0].name).toBe(oranceIncName);

				expect(formallyBananaIncStock[0].sector).toBe(oranceIncSector);

				expect(formallyBananaIncStock[0].industry).toBe(oranceIncIndustry);
			});
		});
	});

	describe("/api/stock/search/:query", () => {
		beforeEach(async () => {
			await insertStock(
				CONSTANTS.STOCKS.APPLE.SYMBOL,
				CONSTANTS.STOCKS.APPLE.NAME,
				CONSTANTS.STOCKS.APPLE.EXCHANGE,
				CONSTANTS.STOCKS.APPLE.ISIN,
				CONSTANTS.STOCKS.APPLE.SECTOR,
				CONSTANTS.STOCKS.APPLE.INDUSTRY,
			);

			await insertStock(
				CONSTANTS.STOCKS.APPLE.SYMBOL.substring(0, 2),
				"Fake Company Name",
				CONSTANTS.STOCKS.APPLE.EXCHANGE,
				"FAKE_ISIN",
				CONSTANTS.STOCKS.APPLE.SECTOR,
				CONSTANTS.STOCKS.APPLE.INDUSTRY,
			);
		});

		it("Should return only what is in the DB that matches LIKE value..", async () => {
			const res = await request(app).get(`/api/stock/search/${CONSTANTS.STOCKS.APPLE.SYMBOL.substring(0, 2)}`).set(
				"authorization",
				`Bearer ${token}`
			);

			expect(res.statusCode).toBe(202);

			expect(res.body).toEqual({
				stocks: [
					{
						symbol: CONSTANTS.STOCKS.APPLE.SYMBOL.substring(0, 2),
						name: "Fake Company Name",
						exchange: CONSTANTS.STOCKS.APPLE.EXCHANGE,
						isin: "FAKE_ISIN",
						sector: CONSTANTS.STOCKS.APPLE.SECTOR,
						industry: CONSTANTS.STOCKS.APPLE.INDUSTRY,
						updated_on: expect.any(String),
					},
					{
						symbol: CONSTANTS.STOCKS.APPLE.SYMBOL,
						name: CONSTANTS.STOCKS.APPLE.NAME,
						exchange: CONSTANTS.STOCKS.APPLE.EXCHANGE,
						isin: CONSTANTS.STOCKS.APPLE.ISIN,
						sector: CONSTANTS.STOCKS.APPLE.SECTOR,
						industry: CONSTANTS.STOCKS.APPLE.INDUSTRY,
						updated_on: expect.any(String),
					},
				]
			});

			expect(extAPIDataProviderStock.queryForStockBySymbol).not.toHaveBeenCalled();
		});
	});
});

describe("Request: POST", () => {
	describe("POST /api/stock/create", () => {
		describe("Failure Cases", () => {
			it("Should fail to create a stock if invalid ISIN passed (ticker not found)..", async () => {
				(extAPIDataProviderStock.getStockProfileByIsin as jest.Mock).mockResolvedValue(null);

				const createRes = await request(app).post("/api/stock/create").set(
					"authorization",
					`Bearer ${token}`
				).send({
					load: {
						isin: CONSTANTS.STOCKS.APPLE.ISIN
					}
				});

				expect(createRes.statusCode).toBe(HTTPStatus.BAD_REQUEST);

				expect(createRes.body.message).toBe("⚠️ Nothing returned from external source for symbol");
			});

			it("Should fail to create a stock if invalid ISIN passed (ticker not found)..", async () => {
				(extAPIDataProviderStock.getStockProfileByIsin as jest.Mock).mockResolvedValue(null);

				const createRes = await request(app).post("/api/stock/create").set(
					"authorization",
					`Bearer ${token}`
				).send({
					load: {
						isin: CONSTANTS.STOCKS.APPLE.ISIN
					}
				});

				expect(createRes.statusCode).toBe(HTTPStatus.BAD_REQUEST);

				expect(createRes.body.message).toBe("⚠️ Nothing returned from external source for symbol");
			});

			it("Should fail to create a stock if already found in the database..", async () => {
				(extAPIDataProviderStock.getStockProfileByIsin as jest.Mock).mockResolvedValue({
					isin: CONSTANTS.STOCKS.APPLE.ISIN,
					symbol: CONSTANTS.STOCKS.APPLE.SYMBOL,
					name: CONSTANTS.STOCKS.APPLE.NAME,
					exchange: CONSTANTS.STOCKS.APPLE.EXCHANGE,
					sector: CONSTANTS.STOCKS.APPLE.SECTOR,
					industry: CONSTANTS.STOCKS.APPLE.INDUSTRY,
				} as IStock);

				await insertStock(
					CONSTANTS.STOCKS.APPLE.SYMBOL,
					CONSTANTS.STOCKS.APPLE.NAME,
					CONSTANTS.STOCKS.APPLE.EXCHANGE,
					CONSTANTS.STOCKS.APPLE.ISIN,
					CONSTANTS.STOCKS.APPLE.SECTOR,
					CONSTANTS.STOCKS.APPLE.INDUSTRY,
				);

				const createRes = await request(app).post("/api/stock/create").set(
					"authorization",
					`Bearer ${token}`
				).send({
					load: {
						isin: CONSTANTS.STOCKS.APPLE.ISIN
					}
				});

				expect(createRes.statusCode).toBe(HTTPStatus.BAD_REQUEST);

				expect(createRes.body.message).toBe("Stock already exists");
			});
		});

		describe("Success Cases", () => {
			it("Should create a stock if it doesnt exist already..", async () => {
				(extAPIDataProviderStock.getStockProfileByIsin as jest.Mock).mockResolvedValue({
					isin: CONSTANTS.STOCKS.APPLE.ISIN,
					symbol: CONSTANTS.STOCKS.APPLE.SYMBOL,
					name: CONSTANTS.STOCKS.APPLE.NAME,
					exchange: CONSTANTS.STOCKS.APPLE.EXCHANGE,
					sector: CONSTANTS.STOCKS.APPLE.SECTOR,
					industry: CONSTANTS.STOCKS.APPLE.INDUSTRY,
				} as IStock);

				const createRes = await request(app).post("/api/stock/create").set(
					"authorization",
					`Bearer ${token}`
				).send({
					load: {
						isin: CONSTANTS.STOCKS.APPLE.ISIN
					}
				});

				expect(createRes.statusCode).toBe(HTTPStatus.CREATED);

				expect(createRes.body.message).toBe("✅ Created stock");
			});
		});
	});

	describe("POST /api/stock/create-by-symbol", () => {
		describe("Failure Cases", () => {
			it("Should fail to create a stock if invalid no symbol passed..", async () => {
				const createRes = await request(app).post("/api/stock/create-by-symbol").set(
					"authorization",
					`Bearer ${token}`
				).send({
					load: {
					}
				});

				expect(createRes.statusCode).toBe(HTTPStatus.BAD_REQUEST);

				expect(createRes.body.message).toBe("❌ Invalid Symbol");
			});

			it("Should fail to create a stock if already found in the database..", async () => {
				(extAPIDataProviderStock.getStockProfileByIsin as jest.Mock).mockResolvedValue({
					isin: CONSTANTS.STOCKS.APPLE.ISIN,
					symbol: CONSTANTS.STOCKS.APPLE.SYMBOL,
					name: CONSTANTS.STOCKS.APPLE.NAME,
					exchange: CONSTANTS.STOCKS.APPLE.EXCHANGE,
					sector: CONSTANTS.STOCKS.APPLE.SECTOR,
					industry: CONSTANTS.STOCKS.APPLE.INDUSTRY,
				} as IStock);

				await insertStock(
					CONSTANTS.STOCKS.APPLE.SYMBOL,
					CONSTANTS.STOCKS.APPLE.NAME,
					CONSTANTS.STOCKS.APPLE.EXCHANGE,
					CONSTANTS.STOCKS.APPLE.ISIN,
					CONSTANTS.STOCKS.APPLE.SECTOR,
					CONSTANTS.STOCKS.APPLE.INDUSTRY,
				);

				const createRes = await request(app).post("/api/stock/create-by-symbol").set(
					"authorization",
					`Bearer ${token}`
				).send({
					load: {
						symbol: CONSTANTS.STOCKS.APPLE.SYMBOL
					}
				});

				expect(createRes.statusCode).toBe(HTTPStatus.BAD_REQUEST);

				expect(createRes.body.message).toBe("Stock already exists");
			});
		});

		describe("Success Cases", () => {
			it("Should create a stock if it doesnt exist already..", async () => {
				(extAPIDataProviderStock.getStockProfileBySymbol as jest.Mock).mockResolvedValue({
					isin: CONSTANTS.STOCKS.APPLE.ISIN,
					symbol: CONSTANTS.STOCKS.APPLE.SYMBOL,
					name: CONSTANTS.STOCKS.APPLE.NAME,
					exchange: CONSTANTS.STOCKS.APPLE.EXCHANGE,
					sector: CONSTANTS.STOCKS.APPLE.SECTOR,
					industry: CONSTANTS.STOCKS.APPLE.INDUSTRY,
				} as IStock);

				const createRes = await request(app).post("/api/stock/create-by-symbol").set(
					"authorization",
					`Bearer ${token}`
				).send({
					load: {
						symbol: CONSTANTS.STOCKS.APPLE.SYMBOL
					}
				});

				expect(createRes.statusCode).toBe(HTTPStatus.CREATED);

				expect(createRes.body.message).toBe("✅ Created stock");
			});
		});
	});

	describe("POST /api/stock/delete", () => {
		beforeEach(async () => {
			await insertStock(
				CONSTANTS.STOCKS.APPLE.SYMBOL,
				CONSTANTS.STOCKS.APPLE.NAME,
				CONSTANTS.STOCKS.APPLE.EXCHANGE,
				CONSTANTS.STOCKS.APPLE.ISIN,
				CONSTANTS.STOCKS.APPLE.SECTOR,
				CONSTANTS.STOCKS.APPLE.INDUSTRY,
			);
		});

		describe("Failure Cases", () => {
			it("requires authentication", async () => {
				await request(app).post("/api/stock/delete").send().expect(401);
			});

			it("fails without stock_isin", async () => {
				const res = await request(app).post("/api/stock/delete").set("authorization", `Bearer ${token}`).send({
					load: {}
				});

				expect(res.statusCode).toBe(HTTPStatus.BAD_REQUEST);

				expect(res.text).toBe("Stock ID is required");
			});
		});

		describe("Success Cases", () => {
			it("deletes stock successfully", async () => {
				const [assets]: any[] = await mySQLPool.promise().query("SELECT * FROM stock;");

				expect(assets.length).toBe(1);

				const deleteRes = await request(app).post("/api/stock/delete").set(
					"authorization",
					`Bearer ${token}`
				).send({
					load: {
						stock_isin: assets[0].isin
					}
				});

				expect(deleteRes.statusCode).toBe(HTTPStatus.OK);

				expect(deleteRes.text).toBe("Deleted stock");

				const [deleted]: any[] = await mySQLPool.promise().query("SELECT * FROM stock;");

				expect(deleted.length).toBe(0);
			});
		});
	});
});

afterAll(async () => {
	await dBDrop(CONSTANTS.DB_NAME, mySQLPool);

	await mySQLPool.end();
});
