class DBBuilderError extends
	Error
{}

import mysql from "mysql2";

import config from "../config";


const queries: string[] = [
	/*
	* ************************
	* * TABLES NON-DEPENDANT *
	* ************************
	*/

	// industry
	`
		CREATE TABLE industry (
			industry VARCHAR(255) NOT NULL UNIQUE PRIMARY KEY
		);
	`,
	// platform
	`
		CREATE TABLE platform (
			platform VARCHAR(255) NOT NULL UNIQUE PRIMARY KEY
		);
	`,
	// query_asset
	`
		CREATE TABLE query_asset (
			id INT AUTO_INCREMENT PRIMARY KEY,
			query VARCHAR(10) NOT NULL,
			refreshed DATETIME NOT NULL,
			UNIQUE KEY unique_query (query),
			CONSTRAINT check_query_format CHECK (query REGEXP '^[A-Za-z]{1,10}$')
		);
	`,
	// sector
	`
		CREATE TABLE sector (
			sector VARCHAR(255) NOT NULL UNIQUE PRIMARY KEY
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
	// asset
	`
		CREATE TABLE asset (
			id VARCHAR(255) NOT NULL UNIQUE PRIMARY KEY,
			sector VARCHAR(255) NOT NULL,
			industry VARCHAR(255) NOT NULL,
			platform VARCHAR(255) NOT NULL,
			name VARCHAR(255) NOT NULL,
			symbol VARCHAR(12) NOT NULL UNIQUE,
			type VARCHAR(255) NOT NULL CHECK (exchange IN ('stock', 'cryptocurrency')),
			refreshed DATETIME NOT NULL,

			FOREIGN KEY (industry) REFERENCES industry(industry) ON DELETE CASCADE,
			FOREIGN KEY (platform) REFERENCES platform(platform) ON DELETE CASCADE,
			FOREIGN KEY (sector) REFERENCES sector(sector) ON DELETE CASCADE
		);
	`,

	// asset_platform
	`
		CREATE TABLE asset_platform (
			id INT PRIMARY KEY AUTO_INCREMENT,
			asset_id INT NOT NULL,
			platform VARCHAR(255) NOT NULL,
			address VARCHAR(100) NOT NULL,

			FOREIGN KEY (asset_id) REFERENCES asset(id)
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
			asset_id INT,
			stock_isin VARCHAR(12),
			percent_allocation DECIMAL(5,2) NOT NULL DEFAULT 0.00 CHECK (percent_allocation BETWEEN 0.00 AND 100.00),
			balance DECIMAL(20,8) NOT NULL DEFAULT 0 CHECK (balance >= 0),
			created DATETIME DEFAULT CURRENT_TIMESTAMP,

			PRIMARY KEY (id),

			FOREIGN KEY (portfolio_id) REFERENCES portfolio(id) ON DELETE CASCADE,
			FOREIGN KEY (asset_id) REFERENCES asset_id(id) ON DELETE CASCADE,

			UNIQUE KEY unique_portfolio_stock (portfolio_id, asset_id)
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

			IF total_allocation + NEW.percent_allocation > 100 THEN
				SIGNAL SQLSTATE '45000'
				SET MESSAGE_TEXT = '[before insert] Total percent allocation for the portfolio exceeds 100';
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

			IF total_allocation + NEW.percent_allocation > 100 THEN
				SIGNAL SQLSTATE '45000'
				SET MESSAGE_TEXT = '[before update] Total percent allocation for the portfolio exceeds 100';
			END IF;
		END;
	`,


	/**
	* ****************
	* * INITIAL DATA *
	* ****************
	*/
	`
		INSERT INTO industry
			(industry)
		VALUES
			('Steel'),
			('Silver'),
			('Other Precious Metals'),
			('Gold'),
			('Copper'),
			('Aluminum'),
			('Paper, Lumber & Forest Products'),
			('Industrial Materials'),
			('Construction Materials'),
			('Chemicals - Specialty'),
			('Chemicals'),
			('Agricultural Inputs'),
			('Telecommunications Services'),
			('Internet Content & Information'),
			('Publishing'),
			('Broadcasting'),
			('Advertising Agencies'),
			('Entertainment'),
			('Travel Lodging'),
			('Travel Services'),
			('Specialty Retail'),
			('Luxury Goods'),
			('Home Improvement'),
			('Residential Construction'),
			('Department Stores'),
			('Personal Products & Services'),
			('Leisure'),
			('Gambling, Resorts & Casinos'),
			('Furnishings, Fixtures & Appliances'),
			('Restaurants'),
			('Auto - Parts'),
			('Auto - Manufacturers'),
			('Auto - Recreational Vehicles'),
			('Auto - Dealerships'),
			('Apparel - Retail'),
			('Apparel - Manufacturers'),
			('Apparel - Footwear & Accessories'),
			('Packaging & Containers'),
			('Tobacco'),
			('Grocery Stores'),
			('Discount Stores'),
			('Household & Personal Products'),
			('Packaged Foods'),
			('Food Distribution'),
			('Food Confectioners'),
			('Agricultural Farm Products'),
			('Education & Training Services'),
			('Beverages - Wineries & Distilleries'),
			('Beverages - Non-Alcoholic'),
			('Beverages - Alcoholic'),
			('Uranium'),
			('Solar'),
			('Oil & Gas Refining & Marketing'),
			('Oil & Gas Midstream'),
			('Oil & Gas Integrated'),
			('Oil & Gas Exploration & Production'),
			('Oil & Gas Equipment & Services'),
			('Oil & Gas Energy'),
			('Oil & Gas Drilling'),
			('Coal'),
			('Shell Companies'),
			('Investment - Banking & Investment Services'),
			('Insurance - Specialty'),
			('Insurance - Reinsurance'),
			('Insurance - Property & Casualty'),
			('Insurance - Life'),
			('Insurance - Diversified'),
			('Insurance - Brokers'),
			('Financial - Mortgages'),
			('Financial - Diversified'),
			('Financial - Data & Stock Exchanges'),
			('Financial - Credit Services'),
			('Financial - Conglomerates'),
			('Financial - Capital Markets'),
			('Banks - Regional'),
			('Banks - Diversified'),
			('Banks'),
			('Asset Management'),
			('Asset Management - Bonds'),
			('Asset Management - Income'),
			('Asset Management - Leveraged'),
			('Asset Management - Cryptocurrency'),
			('Asset Management - Global'),
			('Medical - Specialties'),
			('Medical - Pharmaceuticals'),
			('Medical - Instruments & Supplies'),
			('Medical - Healthcare Plans'),
			('Medical - Healthcare Information Services'),
			('Medical - Equipment & Services'),
			('Medical - Distribution'),
			('Medical - Diagnostics & Research'),
			('Medical - Devices'),
			('Medical - Care Facilities'),
			('Drug Manufacturers - Specialty & Generic'),
			('Drug Manufacturers - General'),
			('Biotechnology'),
			('Waste Management'),
			('Trucking'),
			('Railroads'),
			('Aerospace & Defense'),
			('Marine Shipping'),
			('Integrated Freight & Logistics'),
			('Airlines, Airports & Air Services'),
			('General Transportation'),
			('Manufacturing - Tools & Accessories'),
			('Manufacturing - Textiles'),
			('Manufacturing - Miscellaneous'),
			('Manufacturing - Metal Fabrication'),
			('Industrial - Distribution'),
			('Industrial - Specialties'),
			('Industrial - Pollution & Treatment Controls'),
			('Environmental Services'),
			('Industrial - Machinery'),
			('Industrial - Infrastructure Operations'),
			('Industrial - Capital Goods'),
			('Consulting Services'),
			('Business Equipment & Supplies'),
			('Staffing & Employment Services'),
			('Rental & Leasing Services'),
			('Engineering & Construction'),
			('Security & Protection Services'),
			('Specialty Business Services'),
			('Construction'),
			('Conglomerates'),
			('Electrical Equipment & Parts'),
			('Agricultural - Machinery'),
			('Agricultural - Commodities/Milling'),
			('REIT - Specialty'),
			('REIT - Retail'),
			('REIT - Residential'),
			('REIT - Office'),
			('REIT - Mortgage'),
			('REIT - Industrial'),
			('REIT - Hotel & Motel'),
			('REIT - Healthcare Facilities'),
			('REIT - Diversified'),
			('Real Estate - Services'),
			('Real Estate - Diversified'),
			('Real Estate - Development'),
			('Real Estate - General'),
			('Information Technology Services'),
			('Hardware, Equipment & Parts'),
			('Computer Hardware'),
			('Electronic Gaming & Multimedia'),
			('Software - Services'),
			('Software - Infrastructure'),
			('Software - Application'),
			('Semiconductors'),
			('Media & Entertainment'),
			('Communication Equipment'),
			('Technology Distributors'),
			('Consumer Electronics'),
			('Renewable Utilities'),
			('Regulated Water'),
			('Regulated Gas'),
			('Regulated Electric'),
			('Independent Power Producers'),
			('Diversified Utilities'),
			('General Utilitie'),
			('Decentralized Exchange')
		;
	`,
	`
		INSERT INTO platform
			(platform)
		VALUES
			('arbitrum-one'),
			('arbitrum-nova'),
			('base'),
			('ethereum'),
			('nasdaq'),
			('nyse'),
			('optimistic-ethereum'),
			('solana')
		;
	`,
	`
		INSERT INTO sector
			(sector)
		VALUES
			('Basic Materials'),
			('Cash'),
			('Communication Services'),
			('Consumer Cyclical'),
			('Consumer Defensive'),
			('Decentralized Protocol'),
			('Energy'),
			('Financial Services'),
			('Healthcare'),
			('Industrials'),
			('Macro'),
			('Other'),
			('Real Estate'),
			('Technology'),
			('Utilities')
		;
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
