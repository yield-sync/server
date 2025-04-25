import mysql from "mysql2";


export default {
	createStock: async (mySQLPool: mysql.Pool, stock: IStock) =>
	{
		await mySQLPool.promise().query(
			"INSERT INTO stock (symbol, name, exchange, isin, sector, industry) VALUES (?, ?, ?, ?, ?, ?);",
			[
				stock.symbol,
				stock.name,
				stock.exchange.toLowerCase(),
				stock.isin,
				stock.sector,
				stock.industry,
			]
		);
	},

	deleteStock: async (mySQLPool: mysql.Pool, isin: string): Promise<IStock[]> =>
	{
		let [
			stocks,
		] = await mySQLPool.promise().query<IStock[]>(
			"DELETE FROM stock WHERE isin = ?;",
			[isin,]
		);

		return stocks;
	},

	getStock: async (mySQLPool: mysql.Pool, isin: string): Promise<IStock[]> =>
	{
		let [
			stocks,
		] = await mySQLPool.promise().query<IStock[]>(
			"SELECT * FROM stock WHERE isin = ?;",
			[
				isin,
			]
		);

		return stocks;
	},

	getStockBySymbol: async (mySQLPool: mysql.Pool, symbol: string): Promise<IStock[]> =>
	{
		let [
			stocks,
		] = await mySQLPool.promise().query<IStock[]>(
			"SELECT * FROM stock WHERE symbol = ?;",
			[
				symbol,
			]
		);

		return stocks;
	},

	getStockByLikeSymbol: async (mySQLPool: mysql.Pool, symbol: string): Promise<IStock[]> =>
	{
		let [
			stocks,
		] = await mySQLPool.promise().query<IStock[]>(
			"SELECT * FROM stock WHERE symbol LIKE ?;",
			[
				`%${symbol}%`,
			]
		);

		return stocks;
	},

	updateStock: async (mySQLPool: mysql.Pool, stock: IStock) =>
	{
		await mySQLPool.promise().query(
			"UPDATE stock SET name = ?, symbol = ?, exchange = ?, sector = ?, industry = ? WHERE isin = ?;",
			[
				stock.name,
				stock.symbol,
				stock.exchange.toLowerCase(),
				stock.sector,
				stock.industry,
				stock.isin,
			]
		);
	},

	markStockSymbolUnknown: async (mySQLPool: mysql.Pool, isin: string) =>
	{
		await mySQLPool.promise().query(
			"UPDATE stock SET symbol = ? WHERE isin = ?;",
			[
				isin,
				isin,
			]
		);
	},
};
