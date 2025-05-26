import mysql from "mysql2";

import extAPIDataProviderStock from "../../../external-api/data-provider-stock";
import DBHandlerStock from "../../../db-handler/DBHandlerStock";


const ERROR_STOCK_PROFILE_EXTERNALLY_NOT_FOUND: string = "⚠️ Nothing returned from external source for symbol";


export default class RouteFunctionsStock
{
	private dBHandlerStock: DBHandlerStock;


	constructor(mySQLPool: mysql.Pool)
	{
		this.dBHandlerStock = new DBHandlerStock(mySQLPool);
	}


	/**
	* Create new stock by a provided ISIN
	* @param isin {string}
	* @returns Promise object of stock
	*/
	public createNewStockByIsin = async (isin: string): Promise<IStock> =>
	{
		const dBAsset: IStock[] = await this.dBHandlerStock.getStockByIsin(isin);

		if (dBAsset.length > 0)
		{
			throw new Error("Stock already exists");
		}

		const externalStock: IStock = await extAPIDataProviderStock.getStockProfileByIsin(isin);

		if (!externalStock)
		{
			throw new Error(ERROR_STOCK_PROFILE_EXTERNALLY_NOT_FOUND);
		}

		await this.dBHandlerStock.createStock(externalStock);

		return externalStock;
	};

	/**
	* Create new stock by a provided symbol
	* @param symbol {string} Stock symbol
	* @returns Promise object of Stock
	*/
	public createNewStockBySymbol = async (symbol: string): Promise<IStock> =>
	{
		const dBAsset: IStock[] = await this.dBHandlerStock.getStockBySymbol(symbol);

		if (dBAsset.length > 0)
		{
			throw new Error("Stock already exists");
		}

		const externalStock: IStock = await extAPIDataProviderStock.getStockProfileBySymbol(symbol);

		if (!externalStock)
		{
			throw new Error(ERROR_STOCK_PROFILE_EXTERNALLY_NOT_FOUND);
		}

		await this.dBHandlerStock.createStock(externalStock);

		return externalStock;
	};

	/**
	* Refresh the stock data
	* @notice Utilizes external API
	* @param isin {string}
	* @returns Promise object
	*/
	public refreshStock = async (isin: string): Promise<{dBStockWithExSymbolFound: boolean}> =>
	{
		let externalStock: IStock = await extAPIDataProviderStock.getStockProfileByIsin(isin);

		if (!externalStock)
		{
			throw new Error(ERROR_STOCK_PROFILE_EXTERNALLY_NOT_FOUND);
		}

		let dBStockWithExSymbolFound = false;

		// Could be possible that the symbol used to belong to another stock that no longer owns it
		let stockWithExternallyProvidedSymbol: IStock[] = await this.dBHandlerStock.getStockBySymbol(
			externalStock.symbol
		);

		if (stockWithExternallyProvidedSymbol.length > 0)
		{
			dBStockWithExSymbolFound = true;

			// Set the symbol of the stock that was provided from the external source (if it exists) to "0" (unknown)
			await this.dBHandlerStock.markStockSymbolUnknown(stockWithExternallyProvidedSymbol[0].isin);
		}

		// Stock with ISIN provided from external source already exists -> Update it
		await this.dBHandlerStock.updateStock(externalStock);

		await this.dBHandlerStock.updateRefreshedOn(externalStock);

		if (stockWithExternallyProvidedSymbol.length > 0)
		{
			// Set the symbol of the stock that was provided from the external source (if it exists) to "0" (unknown)
			await this.dBHandlerStock.markStockSymbolUnknown(stockWithExternallyProvidedSymbol[0].isin);

			const externalSearchForDBStockISIN: IStock = await extAPIDataProviderStock.getStockProfileByIsin(
				stockWithExternallyProvidedSymbol[0].isin
			);

			if (externalSearchForDBStockISIN)
			{
				await this.dBHandlerStock.updateStock(externalSearchForDBStockISIN);

				await this.dBHandlerStock.updateRefreshedOn(externalSearchForDBStockISIN);
			}
		}

		return {
			dBStockWithExSymbolFound,
		};
	};
}
