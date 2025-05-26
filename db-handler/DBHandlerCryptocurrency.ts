import mysql from "mysql2";


export default class DBHandlerCryptocurrency
{
	private mySQLPool: mysql.Pool;


	constructor(mySQLPool: mysql.Pool)
	{
		this.mySQLPool = mySQLPool;
	}


	public async createCryptocurrency(cryptocurrency: ICryptocurrency)
	{
		await this.mySQLPool.promise().query(
			"INSERT INTO cryptocurrency (id, symbol, name) VALUES (?, ?, ?);",
			[
				cryptocurrency.id,
				cryptocurrency.symbol,
				cryptocurrency.name,
			]
		);
	};

	public async deleteCryptocurrency(id: string): Promise<ICryptocurrency[]>
	{
		let [
			cryptocurrencies,
		] = await this.mySQLPool.promise().query<ICryptocurrency[]>(
			"DELETE FROM cryptocurrency WHERE id = ?;",
			[
				id,
			]
		);

		return cryptocurrencies;
	};

	public async getCryptocurrencyById(id: string): Promise<ICryptocurrency[]>
	{
		let [
			cryptocurrency,
		] = await this.mySQLPool.promise().query<ICryptocurrency[]>(
			"SELECT * FROM cryptocurrency WHERE id = ?;",
			[
				id
			]
		);

		return cryptocurrency;
	};

	public async getCryptocurrencyBySymbol(symbol: string): Promise<ICryptocurrency[]>
	{
		let [
			cryptocurrencys,
		] = await this.mySQLPool.promise().query<ICryptocurrency[]>(
			"SELECT * FROM cryptocurrency WHERE symbol = ?;",
			[
				symbol,
			]
		);

		return cryptocurrencys;
	};

	public async getCryptocurrencyByLikeSymbol(symbol: string): Promise<ICryptocurrency[]>
	{
		let [
			cryptocurrencys,
		] = await this.mySQLPool.promise().query<ICryptocurrency[]>(
			"SELECT * FROM cryptocurrency WHERE symbol LIKE ? LIMIT 25;",
			[
				`${symbol}%`,
			]
		);

		return cryptocurrencys;
	};
}
