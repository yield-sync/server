import mysql from "mysql2";


export const createStock = async (
	mySQLPool: mysql.Pool,
	symbol: string,
	name: string,
	exchange: string,
	isin: string,
) =>
{
	await mySQLPool.promise().query(
		"INSERT INTO stock (symbol, name, exchange, isin) VALUES (?, ?, ?, ?);",
		[
			symbol,
			name,
			exchange.toLowerCase(),
			isin,
		]
	);
}

export const deleteStock = async (
	mySQLPool: mysql.Pool,
	id: number
): Promise<IStock[]> =>
{
	let [
		stocks,
	] = await mySQLPool.promise().query<IStock[]>(
		"DELETE FROM stock WHERE id = ?;",
		[
			id,
		]
	);

	return stocks;
}

export const getStock = async (mySQLPool: mysql.Pool): Promise<IStock[]> =>
{
	let [
		stocks,
	] = await mySQLPool.promise().query<IStock[]>("SELECT * FROM stock;");

	return stocks;
}

export const getStockById = async (
	mySQLPool: mysql.Pool,
	id: number
): Promise<IStock[]> =>
{
	let [
		stocks,
	] = await mySQLPool.promise().query<IStock[]>(
		"SELECT id FROM stock WHERE id = ?;",
		[
			id,
		]
	);

	return stocks;
}

export const getStockByIsin = async (
	mySQLPool: mysql.Pool,
	isin: string
): Promise<IStock[]> =>
{
	let [
		stocks,
	] = await mySQLPool.promise().query<IStock[]>(
		"SELECT id FROM stock WHERE isin = ?;",
		[
			isin,
		]
	);

	return stocks;
}

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

export const updateStock = async (
	mySQLPool: mysql.Pool,
	symbol: string,
	name: string,
	exchange: string,
	id: number,
) =>
{
	await mySQLPool.promise().query(
		"UPDATE stock SET name = ?, symbol = ?, exchange = ? WHERE id = ?;",
		[
			name,
			symbol,
			exchange.toLowerCase(),
			id,
		]
	);
}

export const updateStockSymbolAndName = async (
	mySQLPool: mysql.Pool,
	symbol: string,
	name: string,
	id: number,
) =>
{
	await mySQLPool.promise().query(
		"UPDATE stock SET symbol = ?, name = ? WHERE id = ?;",
		[
			symbol,
			name,
			id,
		]
	);
}

export const makeStockSymbolUnknown = async (mySQLPool: mysql.Pool, id: number,) =>
{
	await mySQLPool.promise().query(
		"UPDATE stock SET symbol = 0 WHERE id = ?;",
		[
			id,
		]
	);
}
