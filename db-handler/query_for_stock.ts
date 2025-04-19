import mysql from "mysql2";


export const updateQueryForStockTimestamp = async (
	mySQLPool: mysql.Pool,
	query: string,
	last_refresh_timestamp: Date
) =>
{
	await mySQLPool.promise().query(
		`
			INSERT INTO
				query_for_stock (query, last_refresh_timestamp)
			VALUES
				(?, ?)
			ON DUPLICATE KEY UPDATE
				last_refresh_timestamp = ?
			;
		`,
		[
			query,
			last_refresh_timestamp,
			last_refresh_timestamp,
		]
	);
};

export const getQueryForStock = async (
	mySQLPool: mysql.Pool,
	query: string
): Promise<any[]> =>
{
	const [
		queryStock,
	]: [
		any[],
		FieldPacket[]
	] = await mySQLPool.promise().query(
		"SELECT * FROM query_for_stock WHERE query = ?;",
		[
			query,
		]
	);

	return queryStock;
};


export default {
	updateQueryForStockTimestamp,
	getQueryForStock,
};
