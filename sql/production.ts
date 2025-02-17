/**
* This script should be ran to initialize the database.
*/
import mysql from "mysql2";

import config from "../config";
import DBBuilder from "./DBBuilder";


const DB_NAME: string = "yield_sync";


// [mysql] Database connection configuration
const dBConnection: mysql.Connection = mysql.createConnection({
	host: config.app.database.host,
	user: config.app.database.user,
	password: config.app.database.password,
});

dBConnection.connect(
	async (error: Error) =>
	{
		if (error)
		{
			throw new Error(error.stack);
		}
	}
);

async function main()
{
	console.log("Initializing SQL database..");

	// [mock-db] drop and recreate
	await DBBuilder(dBConnection, DB_NAME, true);

	dBConnection.end();
}

main();
