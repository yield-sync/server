import mysql from "mysql2";


export default {
	createAsset: async (mySQLPool: mysql.Pool, asset: IAsset) =>
	{
		await mySQLPool.promise().query(
			"INSERT INTO asset (id, symbol, name, platform, sector, industry) VALUES (?, ?, ?, ?, ?, ?);",
			[
				asset.id,
				asset.symbol,
				asset.name,
				asset.platform.toLowerCase(),
				asset.sector,
				asset.industry,
			]
		);
	},

	deleteAsset: async (mySQLPool: mysql.Pool, id: string): Promise<IAsset[]> =>
	{
		let [
			stocks,
		] = await mySQLPool.promise().query<IAsset[]>(
			"DELETE FROM asset WHERE id = ?;",
			[id,]
		);

		return stocks;
	},

	getAsset: async (mySQLPool: mysql.Pool, id: string): Promise<IAsset[]> =>
	{
		let [
			stocks,
		] = await mySQLPool.promise().query<IAsset[]>(
			"SELECT * FROM asset WHERE id = ?;",
			[
				id,
			]
		);

		return stocks;
	},

	getAssetBySymbol: async (mySQLPool: mysql.Pool, symbol: string): Promise<IAsset[]> =>
	{
		let [
			stocks,
		] = await mySQLPool.promise().query<IAsset[]>(
			"SELECT * FROM asset WHERE symbol = ?;",
			[
				symbol,
			]
		);

		return stocks;
	},

	getAssetWhereSymbolLike: async (mySQLPool: mysql.Pool, query: string): Promise<IAsset[]> =>
	{
		let [
			stocks,
		] = await mySQLPool.promise().query<IAsset[]>(
			"SELECT * FROM asset WHERE symbol LIKE ?;",
			[
				`%${query}%`,
			]
		);

		return stocks;
	},

	updateAsset: async (mySQLPool: mysql.Pool, asset: IAsset) =>
	{
		await mySQLPool.promise().query(
			"UPDATE asset SET name = ?, symbol = ?, platform = ?, sector = ?, industry = ? WHERE id = ?;",
			[
				asset.name,
				asset.symbol,
				asset.platform.toLowerCase(),
				asset.sector,
				asset.industry,
				asset.id,
			]
		);
	},

	markAssetSymbolUnknown: async (mySQLPool: mysql.Pool, id: string) =>
	{
		await mySQLPool.promise().query(
			"UPDATE asset SET symbol = ? WHERE id = ?;",
			[
				id,
				id,
			]
		);
	},
};
