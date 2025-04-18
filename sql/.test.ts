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


beforeEach(async () =>
{
	await dBBuilder(testMySQLPool, TEST_DB_NAME, true);
});

afterEach(async () =>
{
	await dBDrop(TEST_DB_NAME, testMySQLPool);
});

afterAll(async () =>
{
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
				"industry",
				"sector",
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
	let stockIdApple;
	let stockIdMicrosoft;
	let cryptocurrencyIdEthereum;
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

		stockIdApple = stockRows[0].id;

		// Create a stock
		await testMySQLPool.promise().query(
			"INSERT INTO stock (isin, symbol, name, exchange) VALUES (2, 'MSFT', 'Microsoft Inc.', 'nasdaq');"
		);

		const [stockRows2]: any = await testMySQLPool.promise().query(
			"SELECT id FROM stock WHERE symbol = ?;",
			["MSFT"]
		);

		stockIdMicrosoft = stockRows2[0].id;


		// Create a cryptocurrency
		await testMySQLPool.promise().query(
			"INSERT INTO cryptocurrency (symbol, name, coingecko_id) VALUES (?, ?, ?);",
			["ETH", `Ethereum`, `eth`]
		);

		const [cryptocurrencyRow]: any = await testMySQLPool.promise().query(
			"SELECT id FROM cryptocurrency WHERE symbol = ?;",
			["ETH"]
		);

		cryptocurrencyIdEthereum = cryptocurrencyRow[0].id;

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
					[portfolioId, stockIdApple]
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
					[portfolioId, stockIdMicrosoft]
				)
			).resolves.not.toThrow();
		});
	});

	describe("Expected Failure", () => {
		it("Should fail to enter multiple entries of the same cryptocurrency within the same portfolio..", async () => {
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
					[portfolioId, stockIdApple]
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
					[portfolioId, stockIdApple]
				)
			).rejects.toThrow("Duplicate entry '1-1' for key 'unique_portfolio_stock'");
		});

		it("Should fail to enter multiple entries of the same cryptocurrency within the same portfolio..", async () => {
			// Insert portfolio assets within 100% allocation (10,000 basis points)
			await expect(
				testMySQLPool.promise().query(
					`
						INSERT INTO portfolio_asset
							(portfolio_id, cryptocurrency_id, percent_allocation)
						VALUES
							(?, ?, 5000)
						;
					`,
					[portfolioId, cryptocurrencyIdEthereum]
				)
			).resolves.not.toThrow();

			await expect(
				testMySQLPool.promise().query(
					`
						INSERT INTO portfolio_asset
							(portfolio_id, cryptocurrency_id, percent_allocation)
						VALUES
							(?, ?, 5000)
						;
					`,
					[portfolioId, cryptocurrencyIdEthereum]
				)
			).rejects.toThrow("Duplicate entry '1-1' for key 'unique_portfolio_cryptocurrency'");
		});

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
					[portfolioId, stockIdApple, 9000]
				)
			).resolves.not.toThrow();


			// Try to insert another asset that exceeds 100%
			await expect(
				testMySQLPool.promise().query(
					`
						INSERT INTO portfolio_asset
							(portfolio_id, stock_id, percent_allocation)
						VALUES
							(?, ?, ?)
						;
					`,
					[portfolioId, stockIdMicrosoft, 2000] // 20% more (total 110%)
				)
			).rejects.toThrow("[before insert] Total percent allocation for the portfolio exceeds 10000");
		});

		it("Should fail when updating a portfolio asset to exceed allocation limit..", async () => {
			// Insert portfolio assets up to 50%
			await expect(
				testMySQLPool.promise().query(
					"INSERT INTO portfolio_asset (portfolio_id, stock_id, percent_allocation) VALUES (?, ?, ?);",
					[portfolioId, stockIdApple, 10000]
				)
			).resolves.not.toThrow();

			const [portfolioAssetRows]: any = await testMySQLPool.promise().query(
				"SELECT * FROM portfolio_asset WHERE portfolio_id = ? AND percent_allocation = 10000;",
				[portfolioId]
			);

			await expect(
				testMySQLPool.promise().query(
					"UPDATE portfolio_asset SET percent_allocation = ? WHERE id = ?;",
					[10001, portfolioAssetRows[0].id]
				)
			).rejects.toThrow("[before update] Total percent allocation for the portfolio exceeds 10000");
		});
	});
});
