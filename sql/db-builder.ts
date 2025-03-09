import mysql from "mysql2";

import config from "../config";
import { stockExchanges } from "../constants";


const sQLStockExchanges: string = stockExchanges.map((n) =>
{
	return `'${n}'`;
}).join(", ");

const queries: string[] = [
	// user
	`
		CREATE TABLE user (
			id INT NOT NULL AUTO_INCREMENT,
			email VARCHAR(255) NOT NULL,
			password VARCHAR(255) NOT NULL,
			admin BIT(1) DEFAULT 0,
			verified BIT(1) DEFAULT 0,
			created DATETIME DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			UNIQUE(email)
		)
	`,
	// stock
	`
		CREATE TABLE stock (
			id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
			isin VARCHAR(12) NOT NULL UNIQUE,
			exchange VARCHAR(10) NOT NULL CHECK (exchange IN (${sQLStockExchanges})),
			name VARCHAR(255) NOT NULL,
			symbol VARCHAR(255) NOT NULL
		);
	`,
	// cryptocurrency
	`
		CREATE TABLE cryptocurrency (
			id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
			coingecko_id VARCHAR(50) NOT NULL UNIQUE,
			symbol VARCHAR(50) NOT NULL,
			name VARCHAR(100) NOT NULL
		);
	`,
	// cryptocurrency_platform
	`
		CREATE TABLE cryptocurrency_platform (
			id INT PRIMARY KEY AUTO_INCREMENT,
			cryptocurrency_id INT NOT NULL,
			platform VARCHAR(50) NOT NULL,
			address VARCHAR(100) NOT NULL,
			FOREIGN KEY (cryptocurrency_id) REFERENCES cryptocurrency(id)
		);
	`,
	// query_cryptocurrency
	`
		CREATE TABLE query_cryptocurrency (
			id INT AUTO_INCREMENT PRIMARY KEY,
			query VARCHAR(255) NOT NULL,
			last_request_timestamp DATETIME NOT NULL,
			UNIQUE KEY unique_query (query)
		);
	`,
	// stock_industry
	`
		CREATE TABLE stock_industry (
			id INT NOT NULL AUTO_INCREMENT,
			stock_id INT NOT NULL,
			industry VARCHAR(255),
			PRIMARY KEY (id),
			FOREIGN KEY (stock_id) REFERENCES stock(id) ON DELETE CASCADE
		)
	`,
	// stock_sector
	`
		CREATE TABLE stock_sector (
			id INT NOT NULL AUTO_INCREMENT,
			stock_id INT NOT NULL,
			sector VARCHAR(255),
			PRIMARY KEY (id),
			FOREIGN KEY (stock_id) REFERENCES stock(id) ON DELETE CASCADE
		)
	`,
	// portfolio
	`
		CREATE TABLE portfolio (
			id INT NOT NULL AUTO_INCREMENT,
			user_id INT NOT NULL,
			name VARCHAR(255) NOT NULL,
			created DATETIME DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
		)
	`,
	// portfolio_asset
	`
		CREATE TABLE portfolio_asset (
			id INT NOT NULL AUTO_INCREMENT,
			portfolio_id INT NOT NULL,
			cryptocurrency_id INT,
			stock_id INT,
			created DATETIME DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			FOREIGN KEY (portfolio_id) REFERENCES portfolio(id) ON DELETE CASCADE,
			FOREIGN KEY (cryptocurrency_id) REFERENCES cryptocurrency(id) ON DELETE CASCADE,
			FOREIGN KEY (stock_id) REFERENCES stock(id) ON DELETE CASCADE
		)
	`,
	// verification
	`
		CREATE TABLE verification (
			id INT NOT NULL AUTO_INCREMENT,
			user_id INT NOT NULL,
			pin INT UNSIGNED NOT NULL,
			created DATETIME DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
		)
	`,
];


/**
* @notice Script to initialize the database
* @param mySQLPool {mysql.Pool} Connection to the database
* @param dBName {string} Name of the database to be affected
* @param reset {boolean} True if DB is to be dropped first
*/
export const dBBuilder = async (mySQLPool: mysql.Pool, dBName: string, reset: boolean = false) =>
{
	if (reset)
	{
		await mySQLPool.promise().query("DROP DATABASE IF EXISTS ??;", [
			dBName,
		]);
	}

	await mySQLPool.promise().query("CREATE DATABASE ??;", [
		dBName,
	]);
	await mySQLPool.promise().query("USE ??;", [
		dBName,
	]);

	for (const query of queries)
	{
		await mySQLPool.promise().query(query);
	}
};

/**
* @notice This is the function to build the production SQL DB
*/
export async function dBBuilderProduction()
{
	console.log("Initializing SQL database..");

	const mySQLPool: mysql.Pool = mysql.createPool({
		host: config.app.database.host,
		user: config.app.database.user,
		password: config.app.database.password,
		waitForConnections: true,
		connectionLimit: 10,
		queueLimit: 0,
	});

	// [mock-db] drop and recreate
	await dBBuilder(mySQLPool, config.app.database.name, true);

	mySQLPool.end();

	console.log("Done.");
};

/**
* @notice Drop DB
* @param dBName {string} Name of database to drop
* @param mySQLPool {mysql.Pool} Connection to the database
*/
export const dBDrop = async (dBName: string, mySQLPool: mysql.Pool) =>
{
	await mySQLPool.promise().query("DROP DATABASE IF EXISTS ??;", [
		dBName,
	]);
};

export default dBBuilder;

// **Run only if executed from the CLI**
if (require.main === module)
{
	// **Automatically Run Only If `--production` Flag Is Passed**
	if (process.argv.includes("--production"))
	{
		dBBuilderProduction();
	}
	else
	{
		console.log("Nothing happened. If you want to build production db pass '--production' option.");
	}
}
