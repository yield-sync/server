/**
* This script should be ran to initialize the database.
*/
import mysql from "mysql2";

import config from "../config";
import DBBuilder from "./DBBuilder";


async function main()
{
	console.log("Initializing SQL database..");

	// [mysql] Database connection configuration
	const dBConnection = mysql.createPool({
		database: config.app.database_name,
		host: config.app.database.host,
		user: config.app.database.user,
		password: config.app.database.password,
		waitForConnections: true,
		connectionLimit: 10,
		queueLimit: 0
	});

	// [mysql] Select the recreated database
	await dBConnection.promise().query(`USE ${config.app.database_name};`);

	// [mock-db] drop and recreate
	await DBBuilder(dBConnection, config.app.database_name, true);

	dBConnection.end();
}

main();
