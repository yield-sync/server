import mysql from "mysql2";

import config from "../config";


/**
* @notice Script to initialize the database
* @param mySQLPool {mysql.Pool} Connection to the database
* @param dBName {string} Name of the database to be affected
* @param reset {boolean} True if DB is to be dropped first
*/
const dBBuilder = async (mySQLPool: mysql.Pool, dBName: string, reset: boolean = false) =>
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


	// user
	await mySQLPool.promise().query(
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
		`
	);


	// asset
	await mySQLPool.promise().query(
		`
			CREATE TABLE asset (
				id INT NOT NULL AUTO_INCREMENT,
				symbol VARCHAR(255),
				name VARCHAR(255),
				network VARCHAR(10) NOT NULL CHECK (
					network IN ('arbitrum', 'base', 'ethereum', 'nasdaq', 'nyse', 'op-mainnet', 'solana')
				),
				address VARCHAR(255) UNIQUE,
				isin VARCHAR(12) UNIQUE,
				CHECK (
					(network IN ('nasdaq', 'nyse') AND isin IS NOT NULL) OR
					(network IN ('arbitrum', 'base', 'ethereum', 'op-mainnet', 'solana') AND address IS NOT NULL)
				),
				PRIMARY KEY (id)
			);
		`
	);


	// asset_industry
	await mySQLPool.promise().query(
		`
			CREATE TABLE asset_industry (
				id INT NOT NULL AUTO_INCREMENT,
				assetId INT NOT NULL,
				industry VARCHAR(255),
				PRIMARY KEY (id),
				FOREIGN KEY (assetId) REFERENCES asset(id) ON DELETE CASCADE
			)
		`
	);

	// asset_sector
	await mySQLPool.promise().query(
		`
			CREATE TABLE asset_sector (
				id INT NOT NULL AUTO_INCREMENT,
				assetId INT NOT NULL,
				sector VARCHAR(255),
				PRIMARY KEY (id),
				FOREIGN KEY (assetId) REFERENCES asset(id) ON DELETE CASCADE
			)
		`
	);

	// portfolio
	await mySQLPool.promise().query(
		`
			CREATE TABLE portfolio (
				id INT NOT NULL AUTO_INCREMENT,
				user_id INT NOT NULL,
				name VARCHAR(255) NOT NULL,
				created DATETIME DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (id),
				FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
			)
		`
	);

	// portfolio_asset
	await mySQLPool.promise().query(
		`
			CREATE TABLE portfolio_asset (
				id INT NOT NULL AUTO_INCREMENT,
				portfolio_id INT NOT NULL,
				assetId INT NOT NULL,
				created DATETIME DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (id),
				FOREIGN KEY (portfolio_id) REFERENCES portfolio(id) ON DELETE CASCADE,
				FOREIGN KEY (assetId) REFERENCES asset(id) ON DELETE CASCADE
			)
		`
	);

	// verification
	await mySQLPool.promise().query(
		`
			CREATE TABLE verification (
				id INT NOT NULL AUTO_INCREMENT,
				user_id INT NOT NULL,
				pin INT UNSIGNED NOT NULL,
				created DATETIME DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (id),
				FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
			)
		`
	);
};


export default dBBuilder;


export const dropDB = async (dBName: string, mySQLPool: mysql.Pool) =>
{
	await mySQLPool.promise().query("DROP DATABASE IF EXISTS ??;", [
		dBName,
	]);
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
};
