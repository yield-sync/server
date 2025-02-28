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
	await testMySQLPool.promise().query("DELETE FROM crypto;");
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
				"crypto",
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
		it("Should fail when inserting crypto without network..", async () =>
		{
			await expect(
				testMySQLPool.promise().query(
					"INSERT INTO stock (symbol, name, isin) VALUES (?, ?, ?);",
					["AAPl", "Apple Inc.", "US0378331005"]
				)
			).rejects.toThrow("Field 'exchange' doesn't have a default value");
		});

		it("Should fail when inserting crypto with invalid network..", async () =>
		{
			await expect(
				testMySQLPool.promise().query(
					"INSERT INTO crypto (symbol, name, network, address) VALUES (?, ?, ?, ?);",
					["AAPl", "Apple Inc.", "invalid", "US0378331005"]
				)
			).rejects.toThrow("CONSTRAINT `crypto.network` failed for `test_db`.`crypto`");
		});

		it("Should fail when inserting stock crypto without ISIN..", async () =>
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

describe("Crypto", () =>
{
	describe("Expected Failure", () =>
	{
		it("Should fail when inserting crypto without address or native_token = 1..", async () =>
		{
			await expect(
				testMySQLPool.promise().query(
					"INSERT INTO crypto (symbol, name, network) VALUES (?, ?, ?);",
					["ETH", "Ethereum", "ethereum"]
				)
			).rejects.toThrow("CONSTRAINT `CONSTRAINT_1` failed for `test_db`.`crypto`");
		});
	});

	describe("Expected Success", () =>
	{
		it("Should allows inserting a crypto with network..", async () =>
		{
			await expect(
				testMySQLPool.promise().query(
					"INSERT INTO crypto (symbol, name, network, address) VALUES (?, ?, ?, ?);",
					["USDC", "USDC", "ethereum", "0x123"]
				)
			).resolves.not.toThrow();
		});

		it("Should allow inserting 2 cryptos with same address but different networks..", async () => {
			await expect(
				testMySQLPool.promise().query(
					"INSERT INTO crypto (symbol, name, network, address) VALUES (?, ?, ?, ?);",
					["USDC", "USDC", "ethereum", "0x123"]
				)
			).resolves.not.toThrow();

			await expect(
				testMySQLPool.promise().query(
					"INSERT INTO crypto (symbol, name, network, address) VALUES (?, ?, ?, ?);",
					["USDC", "USDC", "base", "0x123"] // Same address, different network
				)
			).resolves.not.toThrow();
		});
	});

	describe("Expected Failure Part 2", () =>
	{
		it("Should not allow inserting 2 cryptos with same address and same network..", async () => {
			await testMySQLPool.promise().query(
				"INSERT INTO crypto (symbol, name, network, address) VALUES (?, ?, ?, ?);",
				["USDC", "USDC", "ethereum", "0x123"]
			);

			await expect(
				testMySQLPool.promise().query(
					"INSERT INTO crypto (symbol, name, network, address) VALUES (?, ?, ?, ?);",
					["USDT", "Tether", "ethereum", "0x123"] // Same network, same address
				)
			).rejects.toThrow(/Duplicate entry/);
		});
	});

	describe("Native Token", () =>
	{
		describe("Expected Failure", () =>
		{
			it("Should fail when inserting a blockchain native crypto with native_token = 0 and no address ..", async () =>
			{
				await expect(
					testMySQLPool.promise().query(
						"INSERT INTO crypto (symbol, name, network, native_token) VALUES (?, ?, ?, ?);",
						["ETH", "Ethereum", "ethereum", 0]
					)
				).rejects.toThrow("CONSTRAINT `CONSTRAINT_1` failed for `test_db`.`crypto`");
			});

			it("Should fail when inserting a blockchain native crypto with native_token = 1 and an address..", async () =>
			{
				await expect(
					testMySQLPool.promise().query(
						"INSERT INTO crypto (symbol, name, network, address, native_token) VALUES (?, ?, ?, ?, ?);",
						["ETH", "Ethereum", "ethereum", "0x000", 1]
					)
				).rejects.toThrow("CONSTRAINT `CONSTRAINT_1` failed for `test_db`.`crypto`");
			});
		});

		describe("Expected Success", () =>
		{
			it("Should allows inserting a blockchain native crypto with native_token = 1 AND no address..", async () =>
			{
				await expect(
					testMySQLPool.promise().query(
						"INSERT INTO crypto (symbol, name, network, native_token) VALUES (?, ?, ?, ?);",
						["ETH", "Ethereum", "ethereum", 1]
					)
				).resolves.not.toThrow();
			});
		});

		describe("Expected Failure Part 2", () =>
		{
			it("Should fail when inserting duplicate native_token = 1..", async () =>
			{
				await expect(
					testMySQLPool.promise().query(
						"INSERT INTO crypto (symbol, name, network, native_token) VALUES (?, ?, ?, ?);",
						["ETH", "Ethereum", "ethereum", 1]
					)
				).resolves.not.toThrow();

				await expect(
					testMySQLPool.promise().query(
						"INSERT INTO crypto (symbol, name, network, native_token) VALUES (?, ?, ?, ?);",
						["ETH2", "Ethereum2", "ethereum", 1]
					)
				).rejects.toThrow(/Duplicate entry/);
			});
		});
	});
});
