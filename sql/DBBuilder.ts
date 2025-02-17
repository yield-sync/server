import { Connection } from "mysql2";


/**
* Script to initialize the database
* @param dBConnection {unrestricited} Connection to the database
* @param dBName {string} Name of the database to be affected
* @param reset {boolean} True if DB is to be dropped first
*/
export default async (dBConnection: Connection, dBName: string, reset: boolean = false) =>
{
	if (reset)
	{
		dBConnection.query(
			`DROP DATABASE IF EXISTS ${dBName};`,
			(error, results, fields) =>
			{
				if (error)
				{
					throw new Error(error.stack);
				}
			}
		);
	}

	dBConnection.query(
		`CREATE DATABASE ${dBName}`,
		(error, results, fields) =>
		{
			if (error)
			{
				throw new Error(error.stack);
			}
		});

	// Select the new database
	dBConnection.changeUser({
		database: dBName
	}, (error) =>
	{
		if (error)
		{
			throw new Error(error.stack);
		}
	});

	// Create the asset table
	dBConnection.query(
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
		`,
		(error, results, fields) =>
		{
			if (error)
			{
				throw new Error(error.stack);
			}
		}
	);

	// Create the user table
	dBConnection.query(
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
		`,
		(error, results, fields) =>
		{
			if (error)
			{
				throw new Error(error.stack);
			}
		}
	);

	// Create the portfolio table
	dBConnection.query(
		`
			CREATE TABLE portfolio (
				PRIMARY KEY (id),
				id INT NOT NULL AUTO_INCREMENT,
				user_id INT NOT NULL,
				name VARCHAR(255) NOT NULL,
				created DATETIME DEFAULT CURRENT_TIMESTAMP
			)
		`,
		(error, results, fields) =>
		{
			if (error)
			{
				throw new Error(error.stack);
			}
		}
	);

	// Create the portfolio asset table
	dBConnection.query(
		`
			CREATE TABLE portfolio_asset (
				PRIMARY KEY (id),
				id INT NOT NULL AUTO_INCREMENT,
				portfolio_id INT NOT NULL,
				ticker VARCHAR(255) NOT NULL,
				created DATETIME DEFAULT CURRENT_TIMESTAMP
			)
		`,
		(error, results, fields) =>
		{
			if (error)
			{
				throw new Error(error.stack);
			}
		}
	);
};


export const dropDB = async (dBName: string, dBConnection: Connection) =>
{
	dBConnection.query(
		`DROP DATABASE IF EXISTS ${dBName}`,
		(error, results, fields) =>
		{
			if (error)
			{
				throw new Error(error.stack);
			}
		}
	);
}

