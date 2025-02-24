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


describe("Database Initialization", () => {
	beforeAll(async () =>
	{
		await dBBuilder(testMySQLPool, TEST_DB_NAME, true);
	});

	afterAll(async () =>
	{
		await dropDB(TEST_DB_NAME, testMySQLPool);
		testMySQLPool.end();
	});

	test("Database and tables are created", async () =>
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
})
