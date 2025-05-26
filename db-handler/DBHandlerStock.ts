import mysql from "mysql2";


export default class DBHandlerStock
{
	private mySQLPool: mysql.Pool;


	constructor(mySQLPool: mysql.Pool)
	{
		this.mySQLPool = mySQLPool;
	}


	public createStock = async (stock: IStock) =>
	{
		await this.mySQLPool.promise().query(
			"INSERT INTO stock (symbol, name, exchange, isin, sector, industry, refreshed_on) VALUES (?, ?, ?, ?, ?, ?, ?);",
			[
				stock.symbol,
				stock.name,
				stock.exchange.toLowerCase(),
				stock.isin,
				stock.sector,
				stock.industry,
				new Date(),
			]
		);
	};

	public deleteStock = async (isin: string): Promise<IStock[]> =>
	{
		let [
			stocks,
		] = await this.mySQLPool.promise().query<IStock[]>(
			"DELETE FROM stock WHERE isin = ?;",
			[
				isin,
			]
		);

		return stocks;
	};

	public getStockByIsin = async (isin: string): Promise<IStock[]> =>
	{
		let [
			stocks,
		] = await this.mySQLPool.promise().query<IStock[]>(
			"SELECT * FROM stock WHERE isin = ?;",
			[
				isin,
			]
		);

		return stocks;
	};

	public getStockBySymbol = async (symbol: string): Promise<IStock[]> =>
	{
		let [
			stocks,
		] = await this.mySQLPool.promise().query<IStock[]>(
			"SELECT * FROM stock WHERE symbol = ?;",
			[
				symbol,
			]
		);

		return stocks;
	};

	public getStockByLikeSymbol = async (symbol: string): Promise<IStock[]> =>
	{
		let [
			stocks,
		] = await this.mySQLPool.promise().query<IStock[]>(
			"SELECT * FROM stock WHERE symbol LIKE ? LIMIT 25;",
			[
				`${symbol}%`,
			]
		);

		return stocks;
	};

	public updateStock = async (stock: IStock) =>
	{
		await this.mySQLPool.promise().query(
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
	};

	public updateRefreshedOn = async (stock: IStock) =>
	{
		await this.mySQLPool.promise().query(
			"UPDATE stock SET refreshed_on = ? WHERE isin = ?;",
			[
				new Date(),
				stock.isin,
			]
		);
	};

	public markStockSymbolUnknown = async (isin: string) =>
	{
		await this.mySQLPool.promise().query(
			"UPDATE stock SET symbol = '0' WHERE isin = ?;",
			[
				isin,
			]
		);
	};
}
