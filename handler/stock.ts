import mysql from "mysql2";


export const getStockBySymbol = async (
	mySQLPool: mysql.Pool,
	symbol: string
): Promise<IStock[]> =>
{
	let [
		stocks,
	] = await mySQLPool.promise().query<IStock[]>(
		"SELECT * FROM stock WHERE symbol = ?;",
		[
			symbol
		]
	);

	return stocks;
}
