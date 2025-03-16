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
	await testMySQLPool.promise().query("DELETE FROM portfolio_asset;");
	await testMySQLPool.promise().query("DELETE FROM user;");
});

afterAll(async () =>
{
	await dBDrop(TEST_DB_NAME, testMySQLPool);
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
				"query_cryptocurrency",
				"query_stock",
				"stock",
				"verification"
			])
		);
	});
});

describe("table: stock", () =>
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

describe("Table: cryptocurrency", () =>
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

describe("Table: query_stock", () => {
	// TODO: Add tests for checking length of query and compliance to constraints
});

describe("Table: portfolio_asset", () => {
	let stockId;
	let userId;
	let portfolioId;


	beforeEach(async () => {
		// Create a user
		await testMySQLPool.promise().query(
			"INSERT INTO user (email, password) VALUES ('email', 'password');"
		);

		const [userRows]: any = await testMySQLPool.promise().query(
			"SELECT id FROM user WHERE email = ?;",
			["email"]
		);

		userId = userRows[0].id;

		// Create a stock
		await testMySQLPool.promise().query(
			"INSERT INTO stock (isin, symbol, name, exchange) VALUES (1, 'AAPL', 'Apple Inc.', 'nasdaq');"
		);

		const [stockRows]: any = await testMySQLPool.promise().query(
			"SELECT id FROM stock WHERE symbol = ?;",
			["AAPL"]
		);

		stockId = stockRows[0].id;

		// Create a portfolio
		await testMySQLPool.promise().query(
			"INSERT INTO portfolio (user_id, name) VALUES (?, ?);",
			[userId, "My Portfolio"]
		);

		const [portfolioRows]: any = await testMySQLPool.promise().query(
			"SELECT id FROM portfolio WHERE name = ?;",
			["My Portfolio"]
		);

		portfolioId = portfolioRows[0].id;
	});


	describe("Expected Success", () => {
		it("Should allow inserting portfolio assets within allocation limits..", async () => {


			// Insert portfolio assets within 100% allocation (10,000 basis points)
			await expect(
				testMySQLPool.promise().query(
					`
						INSERT INTO portfolio_asset
							(portfolio_id, stock_id, percent_allocation)
						VALUES
							(?, ?, 5000)
						;
					`,
					[portfolioId, stockId]
				)
			).resolves.not.toThrow();

			await expect(
				testMySQLPool.promise().query(
					`
						INSERT INTO portfolio_asset
							(portfolio_id, stock_id, percent_allocation)
						VALUES
							(?, ?, 5000)
						;
					`,
					[portfolioId, stockId]
				)
			).resolves.not.toThrow();
		});
	});

	describe("Expected Failure", () => {
		it("Should fail when inserting portfolio asset exceeding allocation limit..", async () => {
			// Insert portfolio assets up to 90%
			await expect(
				testMySQLPool.promise().query(
					`
						INSERT INTO portfolio_asset
							(portfolio_id, stock_id, percent_allocation)
						VALUES
							(?, ?, ?)
						;
					`,
					[portfolioId, stockId, 9000]
				)
			).resolves.not.toThrow();


			// Try to insert another asset that exceeds 100%
			await expect(
				testMySQLPool.promise().query(
					`
						INSERT INTO portfolio_asset
							(portfolio_id, stock_id, percent_allocation)
						VALUES
							(?, ?, )
						;
					`,
					[portfolioId, stockId, 2000] // 20% more (total 110%)
				)
			).rejects.toThrow(/Total percent allocation for the portfolio exceeds 10000/);
		});

		// Add tests for checking if updating verifies allocations
	});
});
