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
				"profile_cryptocurrency",
				"profile_stock",
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
					"INSERT INTO stock (symbol, name, isin, sector, industry) VALUES (?, ?, ?, ?, ?);",
					["AAPL", "Apple Inc.", "US0378331005", "Technology", "Consumer Electronics"]
				)
			).rejects.toThrow("Field 'exchange' doesn't have a default value");
		});

		it("Should fail when inserting stock with invalid exchange..", async () =>
		{
			await expect(
				testMySQLPool.promise().query(
					"INSERT INTO stock (symbol, name, exchange, isin, sector, industry) VALUES (?, ?, ?, ?, ?, ?);",
					["AAPL", "Apple Inc.", "invalid", "US0378331005", "Technology", "Consumer Electronics"]
				)
			).rejects.toThrow(/CONSTRAINT `stock.exchange` failed/);
		});

		it("Should fail when inserting stock without ISIN..", async () =>
		{
			await expect(
				testMySQLPool.promise().query(
					"INSERT INTO stock (symbol, name, exchange, sector, industry) VALUES (?, ?, ?, ?, ?);",
					["AAPL", "Apple Inc.", "nasdaq", "Technology", "Consumer Electronics"]
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
					"INSERT INTO stock (symbol, name, exchange, isin, sector, industry) VALUES (?, ?, ?, ?, ?, ?);",
					["AAPL", "Apple Inc.", "nasdaq", "US0378331005", "Technology", "Consumer Electronics"]
				)
			).resolves.not.toThrow();
		});
	});

	describe("Expected Failure Part 2", () =>
	{
		it("Should fail when inserting duplicate ISIN..", async () =>
		{
			await testMySQLPool.promise().query(
				"INSERT INTO stock (symbol, name, exchange, isin, sector, industry) VALUES (?, ?, ?, ?, ?, ?);",
				["AAPL", "Apple Inc.", "nasdaq", "US0378331005", "Technology", "Consumer Electronics"]
			)

			// Even though the name and symbol are different, the isin already in use
			await expect(
				testMySQLPool.promise().query(
					"INSERT INTO stock (symbol, name, exchange, isin, sector, industry) VALUES (?, ?, ?, ?, ?, ?);",
					["MSFT", "Microsoft Corp.", "nasdaq", "US0378331005", "Technology", "Consumer Electronics"]
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

describe("Table: profile_stock", () => {
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
			`
				INSERT INTO stock
					(isin, symbol, name, exchange, sector, industry)
				VALUES
					(1, 'AAPL', 'Apple Inc.', 'nasdaq', 'Technology', 'Consumer Electronics')
				;
			`
		);

		const [stockRows]: any = await testMySQLPool.promise().query(
			"SELECT isin FROM stock WHERE symbol = ?;",
			["AAPL"]
		);

		stockIdApple = stockRows[0].isin;

		// Create a stock
		await testMySQLPool.promise().query(
			`
				INSERT INTO stock
					(isin, symbol, name, exchange, sector, industry)
				VALUES
					(2, 'MSFT', 'Microsoft Inc.', 'nasdaq', 'Technology', 'Consumer Electronics')
				;
			`
		);

		const [stockRows2]: any = await testMySQLPool.promise().query(
			"SELECT isin FROM stock WHERE symbol = ?;",
			["MSFT"]
		);

		stockIdMicrosoft = stockRows2[0].isin;


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
		it("Should allow inserting portfolio_assets with balance of 0..", async () => {
			await expect(
				testMySQLPool.promise().query(
					`
						INSERT INTO portfolio_asset
							(portfolio_id, stock_isin, percent_allocation, balance)
						VALUES
							(?, ?, 50, 0)
						;
					`,
					[portfolioId, stockIdMicrosoft]
				)
			).rejects.not.toThrow();
		});

		it("Should allow inserting portfolio_assets within allocation limits..", async () => {
			// Insert portfolio assets within 100% allocation
			await expect(
				testMySQLPool.promise().query(
					`
						INSERT INTO portfolio_asset
							(portfolio_id, stock_isin, percent_allocation)
						VALUES
							(?, ?, 50)
						;
					`,
					[portfolioId, stockIdApple]
				)
			).resolves.not.toThrow();

			await expect(
				testMySQLPool.promise().query(
					`
						INSERT INTO portfolio_asset
							(portfolio_id, stock_isin, percent_allocation)
						VALUES
							(?, ?, 50)
						;
					`,
					[portfolioId, stockIdMicrosoft]
				)
			).resolves.not.toThrow();
		});

		it("Should allow inserting portfolio_assets with balance of less than 0", async () => {
			await expect(
				testMySQLPool.promise().query(
					`
						INSERT INTO portfolio_asset
							(portfolio_id, stock_isin, percent_allocation, balance)
						VALUES
							(?, ?, 50, -1)
						;
					`,
					[portfolioId, stockIdMicrosoft]
				)
			).rejects.toThrow("CONSTRAINT `portfolio_asset.balance` failed for `test_db`.`portfolio_asset`");
		});
	});

	describe("Expected Failure", () => {
		it("Should fail to enter multiple entries of the same stock_isin within the same portfolio..", async () => {
			// Insert portfolio assets within 100% allocation
			await expect(
				testMySQLPool.promise().query(
					`
						INSERT INTO portfolio_asset
							(portfolio_id, stock_isin, percent_allocation)
						VALUES
							(?, ?, 50)
						;
					`,
					[portfolioId, stockIdApple]
				)
			).resolves.not.toThrow();

			await expect(
				testMySQLPool.promise().query(
					`
						INSERT INTO portfolio_asset
							(portfolio_id, stock_isin, percent_allocation)
						VALUES
							(?, ?, 50)
						;
					`,
					[portfolioId, stockIdApple]
				)
			).rejects.toThrow("Duplicate entry '1-1' for key 'unique_portfolio_stock'");
		});

		it("Should fail to enter multiple entries of the same cryptocurrency_id within the same portfolio..", async () => {
			// Insert portfolio assets within 100% allocation
			await expect(
				testMySQLPool.promise().query(
					`
						INSERT INTO portfolio_asset
							(portfolio_id, cryptocurrency_id, percent_allocation)
						VALUES
							(?, ?, 50)
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
							(?, ?, 50)
						;
					`,
					[portfolioId, cryptocurrencyIdEthereum]
				)
			).rejects.toThrow("Duplicate entry '1-1' for key 'unique_portfolio_cryptocurrency'");
		});

		it("Should fail to update an existing stock_isin to another stock_isin that is already within the portfolio..",async () => {
			// Insert Apple and Microsoft as separate assets
			await testMySQLPool.promise().query(
				`
					INSERT INTO portfolio_asset
						(portfolio_id, stock_isin, percent_allocation)
					VALUES
						(?, ?, ?);
				`,
				[portfolioId, stockIdApple, 50]
			);

			await testMySQLPool.promise().query(
				`
					INSERT INTO portfolio_asset
						(portfolio_id, stock_isin, percent_allocation)
					VALUES
						(?, ?, ?);
				`,
				[portfolioId, stockIdMicrosoft, 50]
			);

			// Attempt to update MSFT to AAPL (already exists)
			await expect(
				testMySQLPool.promise().query(
					`
						UPDATE portfolio_asset
						SET stock_isin = ?
						WHERE portfolio_id = ? AND stock_isin = ?;
					`,
					[stockIdApple, portfolioId, stockIdMicrosoft]
				)
			).rejects.toThrow("Duplicate entry '1-1' for key 'unique_portfolio_stock'");
		});

		it("Should fail when inserting portfolio asset exceeding allocation limit..", async () => {
			// Insert portfolio assets up to 90%
			await expect(
				testMySQLPool.promise().query(
					`
						INSERT INTO portfolio_asset
							(portfolio_id, stock_isin, percent_allocation)
						VALUES
							(?, ?, ?)
						;
					`,
					[portfolioId, stockIdApple, 90]
				)
			).resolves.not.toThrow();


			// Try to insert another asset that exceeds 100%
			await expect(
				testMySQLPool.promise().query(
					`
						INSERT INTO portfolio_asset
							(portfolio_id, stock_isin, percent_allocation)
						VALUES
							(?, ?, ?)
						;
					`,
					[portfolioId, stockIdMicrosoft, 20] // 20% more (total 110%)
				)
			).rejects.toThrow("[before insert] Total percent allocation for the portfolio exceeds 100");
		});

		it("Should fail when updating a portfolio asset to exceed allocation limit..", async () => {
			// Insert one with 90%
			await testMySQLPool.promise().query(
				`
					INSERT INTO portfolio_asset
						(portfolio_id, stock_isin, percent_allocation)
					VALUES
						(?, ?, ?);
				`,
				[portfolioId, stockIdApple, 90]
			);

			// Insert second with 10%
			await testMySQLPool.promise().query(
				`
					INSERT INTO portfolio_asset
						(portfolio_id, stock_isin, percent_allocation)
					VALUES
						(?, ?, ?);
				`,
				[portfolioId, stockIdMicrosoft, 10]
			);

			// Try to update Apple to 95% (would make total 105%)
			await expect(
				testMySQLPool.promise().query(
					`
						UPDATE portfolio_asset
						SET percent_allocation = ?
						WHERE portfolio_id = ? AND stock_isin = ?;
					`,
					[95, portfolioId, stockIdApple]
				)
			).rejects.toThrow("[before update] Total percent allocation for the portfolio exceeds 100");
		});

		it("Should fail to update portfolio_id to a portfolio that does not belong to the user_id tied to it..", async () => {
			// TODO Complete the test
		});
	});
});
