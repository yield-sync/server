import mysql from "mysql2";


export default class DBHandlerQueryCryptocurrency
{
	private mySQLPool: mysql.Pool;


	constructor(mySQLPool: mysql.Pool)
	{
		this.mySQLPool = mySQLPool;
	}


	public create = async (query) =>
	{
		await this.mySQLPool.promise().query<IQueryCryptocurrency[]>(
			"INSERT INTO query_cryptocurrency (query, last_updated) VALUES (?, ?);",
			[
				query,
				new Date(),
			]
		);
	};

	public updatedNow = async (query) =>
	{
		await this.mySQLPool.promise().query(
			"UPDATE query_cryptocurrency SET last_updated = ? WHERE query = ?;",
			[
				new Date(),
				query
			]
		);
	};

	public getByQuery = async (query: string): Promise<IQueryCryptocurrency[]> =>
	{
		let [
			queryCryptocurrency,
		] = await this.mySQLPool.promise().query<IQueryCryptocurrency[]>(
			"SELECT * FROM query_cryptocurrency WHERE query = ?;",
			[
				query,
			]
		);

		return queryCryptocurrency;
	};
}
