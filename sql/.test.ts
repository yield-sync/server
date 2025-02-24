import mysql from "mysql2";

import dBBuilder, { dropDB } from "./db-builder";
import config from "../config";


// Test Database Name
const TEST_DB_NAME = "test_db";


// Create a test MySQL Pool
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


afterAll(async () =>
{
	await dropDB(TEST_DB_NAME, testMySQLPool);
	testMySQLPool.end();
});


describe("Database Initialization", () =>
{
	it("Database and tables are created..", async () =>
	{
		const [rows] = await testMySQLPool.promise().query("SHOW TABLES;");

		if (!Array.isArray(rows))
		{
			throw new Error("rows is NOT an array");
		}

		const tables = rows.map((row: any) => Object.values(row)[0]);

		expect(tables).toEqual(
			expect.arrayContaining([
				"user",
				"asset",
				"asset_industry",
				"asset_sector",
				"portfolio",
				"portfolio_asset",
				"verification"
			])
		);
	});
});

describe("Asset Table Constraints", () =>
{
	beforeEach(async () =>
	{
		// Ensure test_db is clean before each test
		await testMySQLPool.promise().query("DELETE FROM asset;");
	});

	describe("Expected Failure", () =>
	{
		it("Should fail when inserting asset without network..", async () =>
		{
			await expect(
				testMySQLPool.promise().query(
					"INSERT INTO asset (symbol, name, address) VALUES (?, ?, ?);",
					["ETH", "Ethereum", "0x1234"]
				)
			).rejects.toThrow("Field 'network' doesn't have a default value");
		});

		it("Should fail when inserting asset with invalid network..", async () =>
		{
			await expect(
				testMySQLPool.promise().query(
					"INSERT INTO asset (symbol, name, network, address) VALUES (?, ?, ?, ?);",
					["ETH", "Ethereum", "invalid", "0x1234"]
				)
			).rejects.toThrow("CONSTRAINT `asset.network` failed for `test_db`.`asset`");
		});

		it("Should fail when inserting stock asset without ISIN..", async () =>
		{
			await expect(
				testMySQLPool.promise().query(
					"INSERT INTO asset (symbol, name, network) VALUES (?, ?, ?);",
					["AAPL", "Apple Inc.", "nasdaq"]
				)
			).rejects.toThrow("CONSTRAINT `CONSTRAINT_1` failed for `test_db`.`asset`");
		});

		it("Should fail when inserting blockchain asset without address and native_token..", async () =>
		{
			await expect(
				testMySQLPool.promise().query(
					"INSERT INTO asset (symbol, name, network) VALUES (?, ?, ?);",
					["ETH", "Ethereum", "ethereum"]
				)
			).rejects.toThrow("CONSTRAINT `CONSTRAINT_1` failed for `test_db`.`asset`");
		});

		it("Should fail when inserting duplicate ISIN..", async () =>
		{
			await testMySQLPool.promise().query(
				"INSERT INTO asset (symbol, name, network, isin) VALUES (?, ?, ?, ?);",
				["AAPL", "Apple Inc.", "nasdaq", "US0378331005"]
			);

			await expect(
				testMySQLPool.promise().query(
					"INSERT INTO asset (symbol, name, network, isin) VALUES (?, ?, ?, ?);",
					["MSFT", "Microsoft Corp.", "nasdaq", "US0378331005"]
				)
			).rejects.toThrow(/Duplicate entry/);
		});

		it("Should fail when inserting duplicate address", async () =>
		{
			await testMySQLPool.promise().query(
				"INSERT INTO asset (symbol, name, network, address) VALUES (?, ?, ?, ?);",
				["ETH", "Ethereum", "ethereum", "0x1234"]
			);

			await expect(
				testMySQLPool.promise().query(
					"INSERT INTO asset (symbol, name, network, address) VALUES (?, ?, ?, ?);",
					["USDC", "USD Coin", "ethereum", "0x1234"]
				)
			).rejects.toThrow(/Duplicate entry/);
		});

		it("Should fail when inserting a blockchain asset without address and native_token = 0", async () =>
		{
			await expect(
				testMySQLPool.promise().query(
					"INSERT INTO asset (symbol, name, network, native_token) VALUES (?, ?, ?, ?);",
					["ETH", "Ethereum", "ethereum", 0]
				)
			).rejects.toThrow("CONSTRAINT `CONSTRAINT_1` failed for `test_db`.`asset`");
		});

		it("Should fail when inserting a native token with an address", async () =>
		{
			await expect(
				testMySQLPool.promise().query(
					"INSERT INTO asset (symbol, name, network, address, native_token) VALUES (?, ?, ?, ?, ?);",
					["ETH", "Ethereum", "ethereum", "0x000", 1]
				)
			).rejects.toThrow("CONSTRAINT `CONSTRAINT_1` failed for `test_db`.`asset`");
		});
	});

	describe("Expected Success", () =>
	{
		it("Allows inserting a native blockchain token without an address but with native_token = 1", async () =>
		{
			await expect(
				testMySQLPool.promise().query(
					"INSERT INTO asset (symbol, name, network, native_token) VALUES (?, ?, ?, ?);",
					["ETH", "Ethereum", "ethereum", 1]
				)
			).resolves.not.toThrow();
		});
	});
});
