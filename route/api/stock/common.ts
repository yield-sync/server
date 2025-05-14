import mysql from "mysql2";
import extAPIDataProviderStock from "../../../external-api/data-provider-stock";
import DBHandlerStock from "../../../db-handler/stock";


const ERROR_STOCK_PROFILE_EXTERNALLY_NOT_FOUND: string = "⚠️ Nothing returned from external source for symbol";


export const refreshAsset = async (mySQLPool: mysql.Pool, isin: string): Promise<{dBStockWithExSymbolFound: boolean}> =>
{
	let externalStock: IStock = await extAPIDataProviderStock.getStockProfileByIsin(isin);

	if (!externalStock)
	{
		throw new Error(ERROR_STOCK_PROFILE_EXTERNALLY_NOT_FOUND);
	}

	let dBStockWithExSymbolFound = false;

	// Could be possible that the symbol used to belong to another stock that no longer owns it
	let stockWithExternallyProvidedSymbol: IStock[] = await DBHandlerStock.getStockBySymbol(
		mySQLPool,
		externalStock.symbol
	);

	if (stockWithExternallyProvidedSymbol.length > 0)
	{
		dBStockWithExSymbolFound = true;

		// Set the symbol of the stock that was provided from the external source (if it exists) to "0" (unknown)
		await DBHandlerStock.markStockSymbolUnknown(mySQLPool, stockWithExternallyProvidedSymbol[0].isin);
	}

	// Stock with ISIN provided from external source already exists -> Update it
	await DBHandlerStock.updateStock(mySQLPool, externalStock);

	if (stockWithExternallyProvidedSymbol.length > 0)
	{
		// Set the symbol of the stock that was provided from the external source (if it exists) to "0" (unknown)
		await DBHandlerStock.markStockSymbolUnknown(mySQLPool, stockWithExternallyProvidedSymbol[0].isin);

		const externalSearchForDBStockISIN: IStock = await extAPIDataProviderStock.queryForStockByIsin(
			stockWithExternallyProvidedSymbol[0].isin
		);

		if (externalSearchForDBStockISIN)
		{
			await DBHandlerStock.updateStock(mySQLPool, externalSearchForDBStockISIN);
		}
	}

	return {
		dBStockWithExSymbolFound,
	};
};

export const createNewAssetByIsin = async (mySQLPool: mysql.Pool, isin: string): Promise<IStock> =>
{
	const dBAsset: IStock[] = await DBHandlerStock.getStockByIsin(mySQLPool, isin);

	if (dBAsset.length > 0)
	{
		throw new Error("Stock already exists");
	}

	const externalStock: IStock = await extAPIDataProviderStock.getStockProfileByIsin(isin);

	if (!externalStock)
	{
		throw new Error(ERROR_STOCK_PROFILE_EXTERNALLY_NOT_FOUND);
	}

	await DBHandlerStock.createStock(mySQLPool, externalStock);

	return externalStock;
};

export const createNewAssetBySymbol = async (mySQLPool: mysql.Pool, symbol: string): Promise<IStock> =>
{
	const dBAsset: IStock[] = await DBHandlerStock.getStockBySymbol(mySQLPool, symbol);

	if (dBAsset.length > 0)
	{
		throw new Error("Stock already exists");
	}

	const externalStock: IStock = await extAPIDataProviderStock.getStockProfileBySymbol(symbol);

	if (!externalStock)
	{
		throw new Error(ERROR_STOCK_PROFILE_EXTERNALLY_NOT_FOUND);
	}

	await DBHandlerStock.createStock(mySQLPool, externalStock);

	return externalStock;
};
