import mysql from "mysql2";


export default {
	createCryptocurrency: async (mySQLPool: mysql.Pool, cryptocurrency: ICryptocurrency) =>
	{
		await mySQLPool.promise().query(
			"INSERT INTO cryptocurrency (symbol, name, id) VALUES (?, ?, ?);",
			[
				cryptocurrency.symbol,
				cryptocurrency.name,
			]
		);
	},

	deleteCryptocurrency: async (mySQLPool: mysql.Pool, id: string): Promise<ICryptocurrency[]> =>
	{
		let [
			cryptocurrencys,
		] = await mySQLPool.promise().query<ICryptocurrency[]>(
			"DELETE FROM cryptocurrency WHERE id = ?;",
			[
				id,
			]
		);

		return cryptocurrencys;
	},

	getCryptocurrencyById: async (mySQLPool: mysql.Pool, id: string): Promise<ICryptocurrency[]> =>
	{
		let [
			cryptocurrency,
		] = await mySQLPool.promise().query<ICryptocurrency[]>(
			"SELECT * FROM cryptocurrency WHERE id = ?;",
			[
				id,
			]
		);

		return cryptocurrency;
	},

	getCryptocurrencyBySymbol: async (mySQLPool: mysql.Pool, symbol: string): Promise<ICryptocurrency[]> =>
	{
		let [
			cryptocurrencys,
		] = await mySQLPool.promise().query<ICryptocurrency[]>(
			"SELECT * FROM cryptocurrency WHERE symbol = ?;",
			[
				symbol,
			]
		);

		return cryptocurrencys;
	},

	getCryptocurrencyByLikeSymbol: async (mySQLPool: mysql.Pool, symbol: string): Promise<ICryptocurrency[]> =>
	{
		let [
			cryptocurrencys,
		] = await mySQLPool.promise().query<ICryptocurrency[]>(
			"SELECT * FROM cryptocurrency WHERE symbol LIKE ?;",
			[
				`${symbol}%`,
			]
		);

		return cryptocurrencys;
	},

	updateCryptocurrency: async (mySQLPool: mysql.Pool, cryptocurrency: ICryptocurrency) =>
	{
		await mySQLPool.promise().query(
			"UPDATE cryptocurrency SET name = ?, symbol = ? WHERE id = ?;",
			[
				cryptocurrency.name,
				cryptocurrency.symbol,
				cryptocurrency.id,
			]
		);
	},

	markCryptocurrencySymbolUnknown: async (mySQLPool: mysql.Pool, id: string) =>
	{
		await mySQLPool.promise().query(
			"UPDATE cryptocurrency SET symbol = '0' WHERE id = ?;",
			[
				id,
			]
		);
	},
};
