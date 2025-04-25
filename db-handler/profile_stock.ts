import mysql from "mysql2";


export default {
	updateProfileStockLastUpdated: async (mySQLPool: mysql.Pool, query: string, last_updated: Date) =>
	{
		await mySQLPool.promise().query(
			`
				INSERT INTO
					profile_stock (query, last_updated)
				VALUES
					(?, ?)
				ON DUPLICATE KEY UPDATE
					last_updated = ?
				;
			`,
			[
				query,
				last_updated,
				last_updated,
			]
		);
	},

	getProfileStock: async (mySQLPool: mysql.Pool, query: string): Promise<any[]> =>
	{
		const [
			queryStock,
		]: [
			any[],
			FieldPacket[]
		] = await mySQLPool.promise().query(
			"SELECT * FROM profile_stock WHERE query = ?;",
			[
				query,
			]
		);

		return queryStock;
	},
};
