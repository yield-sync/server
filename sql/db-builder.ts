import mysql from "mysql2";

import config from "../config";
import { blockchainNetworks, stockExchanges } from "../constants";

const sQLBlockchainNetworks: string = blockchainNetworks.map((n) =>
{
	return `'${n}'`;
}).join(", ");

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
	// crypto
	`
		CREATE TABLE crypto (
			id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
			native_token BIT(1) NOT NULL DEFAULT 0,
			network VARCHAR(10) NOT NULL CHECK (network IN (${sQLBlockchainNetworks})),
			isin VARCHAR(12) UNIQUE,
			address VARCHAR(255),
			name VARCHAR(255) NOT NULL,
			symbol VARCHAR(255) NOT NULL,
			UNIQUE KEY unique_native_token_per_network (network, native_token),
			UNIQUE KEY unique_address_per_network (network, address),
			CHECK (
				(address IS NOT NULL AND native_token = 0) OR
				(address IS NULL AND native_token = 1)
			)
		);
	`,
	// stock_industry
	`
		CREATE TABLE stock_industry (
			id INT NOT NULL AUTO_INCREMENT,
			stockId INT NOT NULL,
			industry VARCHAR(255),
			PRIMARY KEY (id),
			FOREIGN KEY (stockId) REFERENCES stock(id) ON DELETE CASCADE
		)
	`,
	// stock_sector
	`
		CREATE TABLE stock_sector (
			id INT NOT NULL AUTO_INCREMENT,
			stockId INT NOT NULL,
			sector VARCHAR(255),
			PRIMARY KEY (id),
			FOREIGN KEY (stockId) REFERENCES stock(id) ON DELETE CASCADE
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
			portfolioId INT NOT NULL,
			stockId INT,
			created DATETIME DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			FOREIGN KEY (portfolioId) REFERENCES portfolio(id) ON DELETE CASCADE,
			FOREIGN KEY (stockId) REFERENCES stock(id) ON DELETE CASCADE
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
		queueLimit: 0
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
