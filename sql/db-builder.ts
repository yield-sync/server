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
		await mySQLPool.promise().query("DROP DATABASE IF EXISTS ??;", [dBName]);
	}

	await mySQLPool.promise().query("CREATE DATABASE ??;", [dBName]);

	// [mysql] Select the recreated database
	await mySQLPool.promise().query("USE ??;", [dBName]);

	// Create the asset table
	await mySQLPool.promise().query(
		`
			CREATE TABLE asset (
				PRIMARY KEY (id),
				symbol VARCHAR(255) NOT NULL,
				name VARCHAR(255) NOT NULL,
				id INT NOT NULL AUTO_INCREMENT,
				industry VARCHAR(255),
				sector VARCHAR(255),
				exchange VARCHAR(255)
			)
		`
	);

	// Create the portfolio table
	await mySQLPool.promise().query(
		`
			CREATE TABLE portfolio (
				PRIMARY KEY (id),
				id INT NOT NULL AUTO_INCREMENT,
				user_id INT NOT NULL,
				name VARCHAR(255) NOT NULL,
				created DATETIME DEFAULT CURRENT_TIMESTAMP
			)
		`
	);

	// Create the portfolio asset table
	await mySQLPool.promise().query(
		`
			CREATE TABLE portfolio_asset (
				PRIMARY KEY (id),
				id INT NOT NULL AUTO_INCREMENT,
				portfolio_id INT NOT NULL,
				ticker VARCHAR(255) NOT NULL,
				created DATETIME DEFAULT CURRENT_TIMESTAMP
			)
		`
	);

	// Create the user table
	await mySQLPool.promise().query(
		`
			CREATE TABLE user (
				PRIMARY KEY (id),
				UNIQUE(email),
				id INT NOT NULL AUTO_INCREMENT,
				email VARCHAR(255) NOT NULL,
				password VARCHAR(255) NOT NULL,
				admin BIT(1) DEFAULT 0,
				verified BIT(1) DEFAULT 0,
				created DATETIME DEFAULT CURRENT_TIMESTAMP
			)
		`
	);

	// Create the verification table
	await mySQLPool.promise().query(
		`
			CREATE TABLE verification (
				PRIMARY KEY (id),
				id INT NOT NULL AUTO_INCREMENT,
				user INT NOT NULL,
				pin INT UNSIGNED NOT NULL,
				created DATETIME DEFAULT CURRENT_TIMESTAMP
			)
		`
	);
};


export default dBBuilder;


export const dropDB = async (dBName: string, mySQLPool: mysql.Pool) =>
{
	await mySQLPool.promise().query("DROP DATABASE IF EXISTS ??;", [dBName]);
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
