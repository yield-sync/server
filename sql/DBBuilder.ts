import mysql from "mysql2";


/**
* Script to initialize the database
* @param dBConnection {mysql.Pool} Connection to the database
* @param dBName {string} Name of the database to be affected
* @param reset {boolean} True if DB is to be dropped first
*/
export default async (dBConnection: mysql.Pool, dBName: string, reset: boolean = false) =>
{
	if (reset) {
		await dBConnection.promise().query(`DROP DATABASE IF EXISTS ??;`, [dBName]);
	}

	await dBConnection.promise().query(`CREATE DATABASE ??;`, [dBName]);

	// [mysql] Select the recreated database
	await dBConnection.promise().query(`USE ??;`, [dBName]);

	// Create the asset table
	await dBConnection.promise().query(
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

	// Create the user table
	await dBConnection.promise().query(
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

	// Create the portfolio table
	await dBConnection.promise().query(
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
	dBConnection.promise().query(
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
};


export const dropDB = async (dBName: string, dBConnection: mysql.Pool) =>
{
	await dBConnection.promise().query(`DROP DATABASE IF EXISTS ${dBName}`);
}

