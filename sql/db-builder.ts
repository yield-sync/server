class DBBuilderError extends
	Error
{}

import mysql from "mysql2";

import config from "../config";
import { stockExchanges } from "../constants";


const sQLStockExchanges: string = stockExchanges.map((n) =>
{
	return `'${n}'`;
}).join(", ");

const queries: string[] = [
	/*
	* ************************
	* * TABLES NON-DEPENDANT *
	* ************************
	*/


	// cryptocurrency
	`
		CREATE TABLE cryptocurrency (
			id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
			coingecko_id VARCHAR(50) NOT NULL UNIQUE,
			symbol VARCHAR(50) NOT NULL,
			name VARCHAR(100) NOT NULL
		);
	`,
	// industry
	`
		CREATE TABLE industry (
			id INT NOT NULL AUTO_INCREMENT,
			name VARCHAR(255),
			PRIMARY KEY (id)
		);
	`,
	// query_cryptocurrency
	`
		CREATE TABLE query_cryptocurrency (
			id INT AUTO_INCREMENT PRIMARY KEY,
			query VARCHAR(50) NOT NULL,
			last_refresh_timestamp DATETIME NOT NULL,
			UNIQUE KEY unique_query (query)
		);
	`,
	// query_stock
	`
		CREATE TABLE query_stock (
			id INT AUTO_INCREMENT PRIMARY KEY,
			query VARCHAR(10) NOT NULL,
			last_refresh_timestamp DATETIME NOT NULL,
			UNIQUE KEY unique_query (query),
			CONSTRAINT check_query_format CHECK (query REGEXP '^[A-Za-z]{1,10}$')
		);
	`,
	// sector
	`
		CREATE TABLE sector (
			id INT NOT NULL AUTO_INCREMENT,
			name VARCHAR(255),
			PRIMARY KEY (id)
		);
	`,
	// stock
	`
		CREATE TABLE stock (
			id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
			isin VARCHAR(12) NOT NULL UNIQUE,
			exchange VARCHAR(10) NOT NULL CHECK (exchange IN (${sQLStockExchanges})),
			name VARCHAR(255) NOT NULL,
			symbol VARCHAR(255) NOT NULL UNIQUE
		);
	`,
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

	/*
	* ********************
	* * TABLES DEPENDANT *
	* ********************
	*/

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
	// portfolio
	`
		CREATE TABLE portfolio (
			id INT NOT NULL AUTO_INCREMENT,
			user_id INT NOT NULL,
			name VARCHAR(255) NOT NULL,
			created DATETIME DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
		);
	`,
	// portfolio_asset
	`
		CREATE TABLE portfolio_asset (
			id INT NOT NULL AUTO_INCREMENT,
			portfolio_id INT NOT NULL,
			cryptocurrency_id INT,
			stock_id INT,
			percent_allocation INT NOT NULL DEFAULT 0 CHECK (percent_allocation BETWEEN 0 AND 10000),
			created DATETIME DEFAULT CURRENT_TIMESTAMP,

			PRIMARY KEY (id),

			FOREIGN KEY (portfolio_id) REFERENCES portfolio(id) ON DELETE CASCADE,
			FOREIGN KEY (cryptocurrency_id) REFERENCES cryptocurrency(id) ON DELETE CASCADE,
			FOREIGN KEY (stock_id) REFERENCES stock(id) ON DELETE CASCADE,

			UNIQUE KEY unique_portfolio_cryptocurrency (portfolio_id, cryptocurrency_id),
			UNIQUE KEY unique_portfolio_stock (portfolio_id, stock_id)
		);
	`,
	// verification
	`
		CREATE TABLE verification (
			id INT NOT NULL AUTO_INCREMENT,
			user_id INT NOT NULL UNIQUE,
			pin CHAR(6) NOT NULL CHECK (CHAR_LENGTH(pin) = 6),
			attempts TINYINT UNSIGNED NOT NULL DEFAULT 0 CHECK (attempts <= 3),
			created DATETIME DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
		);
	`,
	// recovery
	`
		CREATE TABLE recovery (
			id INT NOT NULL AUTO_INCREMENT,
			user_id INT NOT NULL UNIQUE,
			pin CHAR(6) NOT NULL CHECK (CHAR_LENGTH(pin) = 6),
			attempts TINYINT UNSIGNED NOT NULL DEFAULT 0 CHECK (attempts <= 3),
			created DATETIME DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
		);
	`,

	/*
	* ************
	* * TRIGGERS *
	* ************
	*/

	// Before Insert - portfolio_asset
	`
		CREATE TRIGGER before_insert_portfolio_asset
		BEFORE INSERT ON portfolio_asset
		FOR EACH ROW
		BEGIN
			DECLARE total_allocation INT;

			SELECT COALESCE(SUM(percent_allocation), 0)
			INTO total_allocation
			FROM portfolio_asset
			WHERE portfolio_id = NEW.portfolio_id;

			IF total_allocation + NEW.percent_allocation > 10000 THEN
				SIGNAL SQLSTATE '45000'
				SET MESSAGE_TEXT = '[before insert] Total percent allocation for the portfolio exceeds 10000';
			END IF;
		END;
	`,
	// Before Update - portfolio_asset
	`
		CREATE TRIGGER before_update_portfolio_asset
		BEFORE UPDATE ON portfolio_asset
		FOR EACH ROW
		BEGIN
			DECLARE total_allocation INT;

			SELECT COALESCE(SUM(percent_allocation), 0)
			INTO total_allocation
			FROM portfolio_asset
			WHERE portfolio_id = NEW.portfolio_id AND id != OLD.id;

			IF total_allocation + NEW.percent_allocation > 10000 THEN
				SIGNAL SQLSTATE '45000'
				SET MESSAGE_TEXT = '[before update] Total percent allocation for the portfolio exceeds 10000';
			END IF;
		END;
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
export async function dBBuilderProduction(overwrite: boolean)
{
	console.log("[dBBuilderProduction] Initializing production SQL database..");

	if (
		!config.app.database.host ||
		!config.app.database.name ||
		!config.app.database.password ||
		!config.port ||
		!config.app.database.user
	)
	{
		throw new DBBuilderError("Missing SQL database connection values");
	}

	const mySQLPool: mysql.Pool = mysql.createPool({
		host: config.app.database.host,
		password: config.app.database.password,
		port: Number(config.app.database.port),
		user: config.app.database.user,
		waitForConnections: true,
		connectionLimit: 10,
		queueLimit: 0,
	}).on("connection", (connection) =>
	{
		console.log("[info] ✅ Successfully connected to the MySQL Database");
	}).on("error", (err) =>
	{
		console.error("[error] MySQL Pool:", err);
	});

	try
	{
		// Check if the database exists
		const [
			databases,
		] = await mySQLPool.promise().query("SHOW DATABASES LIKE ?;", [
			config.app.database.name,
		]);

		if (!Array.isArray(databases))
		{
			throw new DBBuilderError("\"databases\" value not array");
		}

		// If the database exists and overwrite is not requested, skip creation
		if (databases.length > 0 && !overwrite)
		{
			console.log(`[info] Database "${config.app.database.name}" already exists. Skipping creation.`);

			return;
		}

		// Drop and recreate the database if overwrite is requested or if it doesn't exist
		if (overwrite)
		{
			await mySQLPool.promise().query("DROP DATABASE IF EXISTS ??;", [
				config.app.database.name,
			]);

			console.log(`[info] Database "${config.app.database.name}" dropped.`);
		}

		// Create the database and run the queries
		await dBBuilder(mySQLPool, config.app.database.name);

		console.log(`[info] Database "${config.app.database.name}" created.`);
	}
	catch (error)
	{
		throw new DBBuilderError("Error initializing the database: " + error);
	}
	finally
	{
		await mySQLPool.promise().end();
	}
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
