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
			`
				INSERT INTO
					stock
				(
					isin,
					symbol,
					exchange,
					industry,
					name,
					sector,
					address,
					ceo,
					city,
					country,
					description,
					full_time_employees,
					ipo_date,
					is_etf,
					phone,
					price_on_refresh,
					state,
					website,
					zip,
					refreshed_on
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
			`,
			[

				stock.isin,
				stock.symbol,
				stock.exchange.toLowerCase(),
				stock.industry,
				stock.name,
				stock.sector,
				stock.address,
				stock.ceo,
				stock.city,
				stock.country,
				stock.description,
				stock.fullTimeEmployees,
				stock.ipoDate,
				stock.isEtf,
				stock.phone,
				stock.price_on_refresh,
				stock.state,
				stock.website,
				stock.zip,
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
			`UPDATE
				stock
			SET
				symbol = ?,
				exchange = ?,
				industry = ?,
				name = ?,
				sector = ?,
				address = ?,
				ceo = ?,
				city = ?,
				country = ?,
				full_time_employees = ?,
				ipo_date = ?,
				is_etf = ?,
				phone = ?,
				price_on_refresh = ?,
				state = ?,
				website = ?,
				zip = ?
			WHERE
				isin = ?
			;
			`,
			[
				stock.symbol,
				stock.exchange.toLowerCase(),
				stock.industry,
				stock.name,
				stock.sector,
				stock.address,
				stock.ceo,
				stock.city,
				stock.country,
				stock.fullTimeEmployees,
				stock.ipoDate,
				stock.isEtf,
				stock.phone,
				stock.price_on_refresh,
				stock.state,
				stock.website,
				stock.zip,
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
