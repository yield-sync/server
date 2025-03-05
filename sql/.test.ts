import mysql from "mysql2";

import dBBuilder, { dBDrop } from "./db-builder";
import config from "../config";


const TEST_DB_NAME = "test_db";


const testMySQLPool: mysql.Pool = mysql.createPool({
	host: config.app.database.host,
	user: config.app.database.user,
	password: config.app.database.password,
	waitForConnections: true,
	connectionLimit: 5,
	queueLimit: 0
});


beforeAll(async () =>
{
	await dBBuilder(testMySQLPool, TEST_DB_NAME, true);
});

beforeEach(async () =>
{
	await testMySQLPool.promise().query("DELETE FROM stock;");
	await testMySQLPool.promise().query("DELETE FROM cryptocurrency_platform;");
	await testMySQLPool.promise().query("DELETE FROM cryptocurrency;");
});

afterAll(async () =>
{
	//await dBDrop(TEST_DB_NAME, testMySQLPool);
	testMySQLPool.end();
});


describe("Database Initialization", () =>
{
	it("Should create the database and tables..", async () =>
	{
		const [rows] = await testMySQLPool.promise().query("SHOW TABLES;");

		if (!Array.isArray(rows))
		{
			throw new Error("rows is NOT an array");
		}

		const tables = rows.map((row: any) => Object.values(row)[0]);

		expect(tables).toEqual(
			expect.arrayContaining([
				"stock_industry",
				"stock_sector",
				"cryptocurrency",
				"cryptocurrency_platform",
				"portfolio",
				"portfolio_asset",
				"user",
				"stock",
				"verification"
			])
		);
	});
});

describe("Stock", () =>
{
	describe("Expected Failure", () =>
	{
		it("Should fail when inserting stock without exchange..", async () =>
		{
			await expect(
				testMySQLPool.promise().query(
					"INSERT INTO stock (symbol, name, isin) VALUES (?, ?, ?);",
					["AAPL", "Apple Inc.", "US0378331005"]
				)
			).rejects.toThrow("Field 'exchange' doesn't have a default value");
		});

		it("Should fail when inserting stock with invalid exchange..", async () =>
		{
			await expect(
				testMySQLPool.promise().query(
					"INSERT INTO stock (symbol, name, exchange, isin) VALUES (?, ?, ?, ?);",
					["AAPL", "Apple Inc.", "invalid", "US0378331005"]
				)
			).rejects.toThrow(/CONSTRAINT `stock.exchange` failed/);
		});

		it("Should fail when inserting stock without ISIN..", async () =>
		{
			await expect(
				testMySQLPool.promise().query(
					"INSERT INTO stock (symbol, name, exchange) VALUES (?, ?, ?);",
					["AAPL", "Apple Inc.", "nasdaq"]
				)
			).rejects.toThrow("Field 'isin' doesn't have a default value");
		});
	});

	describe("Expected Success", () =>
	{
		it("Should allows inserting a stock with ISIN..", async () =>
		{
			await expect(
				testMySQLPool.promise().query(
					"INSERT INTO stock (symbol, name, exchange, isin) VALUES (?, ?, ?, ?);",
					["AAPL", "Apple Inc.", "nasdaq", "US0378331005"]
				)
			).resolves.not.toThrow();
		});
	});

	describe("Expected Failure Part 2", () =>
	{
		it("Should fail when inserting duplicate ISIN..", async () =>
		{
			await testMySQLPool.promise().query(
				"INSERT INTO stock (symbol, name, exchange, isin) VALUES (?, ?, ?, ?);",
				["AAPL", "Apple Inc.", "nasdaq", "US0378331005"]
			)

			// Even though the name and symbol are different, the isin already in use
			await expect(
				testMySQLPool.promise().query(
					"INSERT INTO stock (symbol, name, exchange, isin) VALUES (?, ?, ?, ?);",
					["MSFT", "Microsoft Corp.", "nasdaq", "US0378331005"]
				)
			).rejects.toThrow(/Duplicate entry/);
		});
	});
});

describe("Cryptocurrency", () =>
{
	describe("Expected Failure", () =>
	{
		it("Should fail when inserting cryptocurrency without coingecko_id..", async () =>
		{
			await expect(
				testMySQLPool.promise().query(
					"INSERT INTO cryptocurrency (symbol, name) VALUES (?, ?);",
					["ETH", "Ethereum"]
				)
			).rejects.toThrow("Field 'coingecko_id' doesn't have a default value");
		});
	});

	describe("Expected Success", () =>
	{
		it("Should allow inserting a cryptocurrency with platform..", async () =>
		{
			await testMySQLPool.promise().query(
				"INSERT INTO cryptocurrency (coingecko_id, symbol, name) VALUES (?, ?, ?);",
				["ethereum", "ETH", "Ethereum"]
			);

			await expect(
				testMySQLPool.promise().query(
					"INSERT INTO cryptocurrency_platform (cryptocurrency_id, platform, address) VALUES (LAST_INSERT_ID(), ?, ?);",
					["ethereum", "0x123"]
				)
			).resolves.not.toThrow();
		});

		it("Should allow inserting cryptocurrency with same address on different platforms..", async () => {
			await testMySQLPool.promise().query(
				"INSERT INTO cryptocurrency (coingecko_id, symbol, name) VALUES (?, ?, ?);",
				["usdc", "USDC", "USD Coin"]
			);

			await testMySQLPool.promise().query(
				"INSERT INTO cryptocurrency_platform (cryptocurrency_id, platform, address) VALUES (LAST_INSERT_ID(), ?, ?);",
				["ethereum", "0x123"]
			);

			await testMySQLPool.promise().query(
				"INSERT INTO cryptocurrency (coingecko_id, symbol, name) VALUES (?, ?, ?);",
				["usdc-base", "USDC", "USD Coin Base"]
			);

			await expect(
				testMySQLPool.promise().query(
					"INSERT INTO cryptocurrency_platform (cryptocurrency_id, platform, address) VALUES (LAST_INSERT_ID(), ?, ?);",
					["base", "0x123"]
				)
			).resolves.not.toThrow();
		});
	});

	describe("Expected Failure Part 2", () =>
	{
		it("Should fail when inserting duplicate coingecko_id..", async () =>
		{
			await testMySQLPool.promise().query(
				"INSERT INTO cryptocurrency (coingecko_id, symbol, name) VALUES (?, ?, ?);",
				["ethereum", "ETH", "Ethereum"]
			);

			await expect(
				testMySQLPool.promise().query(
					"INSERT INTO cryptocurrency (coingecko_id, symbol, name) VALUES (?, ?, ?);",
					["ethereum", "ETH2", "Ethereum 2"]
				)
			).rejects.toThrow(/Duplicate entry/);
		});
	});
});
