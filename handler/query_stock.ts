import mysql from "mysql2";


export const updateQueryStock = async (
	mySQLPool: mysql.Pool,
	query: string,
	last_refresh_timestamp: Date
) =>
{
	await mySQLPool.promise().query(
		`
			INSERT INTO
				query_stock (query, last_refresh_timestamp)
			VALUES
				(?, ?)
			ON DUPLICATE KEY UPDATE
				last_refresh_timestamp = ?
			;
		`,
		[query, last_refresh_timestamp, last_refresh_timestamp]
	);
}
