import mysql from "mysql2";


export default {
	updateRefreshed: async (mySQLPool: mysql.Pool, query: string, refreshed: Date) =>
	{
		await mySQLPool.promise().query(
			`
				INSERT INTO
					query_asset (query, refreshed)
				VALUES
					(?, ?)
				ON DUPLICATE KEY UPDATE
					refreshed = ?
				;
			`,
			[
				query,
				refreshed,
				refreshed,
			]
		);
	},

	getQueryAsset: async (mySQLPool: mysql.Pool, query: string): Promise<any[]> =>
	{
		const [
			queryStock,
		]: [
			any[],
			FieldPacket[]
		] = await mySQLPool.promise().query(
			"SELECT * FROM query_asset WHERE query = ?;",
			[
				query,
			]
		);

		return queryStock;
	},
};
