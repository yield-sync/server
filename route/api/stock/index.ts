import express from "express";
import mysql from "mysql2";

import { loadRequired } from "../../../middleware/load";
import userToken from "../../../middleware/user-token";
import { INTERNAL_SERVER_ERROR, HTTPStatus, stockExchanges } from "../../../constants";
import DBHandlerStock from "../../../db-handler/stock";
import { sanitizeSymbolQuery } from "../../../util/sanitizer";
import extAPIDataProviderStock from "../../../external-api/data-provider-stock";


const ONE_WEEK_IN_MINUTES: number = 10080;
const ONE_WEEK_IN_MS: number = ONE_WEEK_IN_MINUTES * 60 * 1000;


const refreshAsset = async (mySQLPool: mysql.Pool, isin: string) => {
	let externalStock: IStock = await extAPIDataProviderStock.getStockProfile(isin);

	if (!externalStock)
	{
		throw new Error("Nothing returned from external source");
	}

	// Could be possible that the symbol used to belong to another stock that no longer owns it
	let stockWithExternallyProvidedSymbol: IStock[] = await DBHandlerStock.getStockBySymbol(
		mySQLPool,
		externalStock.symbol
	);

	if (stockWithExternallyProvidedSymbol.length > 0)
	{
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
		else
		{
			console.warn(`Nothing was found for ISIN "${stockWithExternallyProvidedSymbol[0].isin}". symbol will remain 0`);
		}
	}
}

const processNewAsset = async (mySQLPool: mysql.Pool, symbol: string): Promise<void> => {
	const externalStock: IStock = await extAPIDataProviderStock.getStockProfile(symbol);

	if (!externalStock)
	{
		throw new Error("Nothing found for symbol");
	}
	else
	{
		await DBHandlerStock.createStock(mySQLPool, externalStock);
	}
};


export default (mySQLPool: mysql.Pool): express.Router =>
{
	return express.Router().get(
		/**
		* @desc Get asset profile
		* @param id {string}
		*/
		"/read/:isin",
		async (req: express.Request, res: express.Response) =>
		{
			let response: StockSearchQuery = {
				UpdateStockPerformed: false,
				stock: null,
			};

			try
			{
				const { isin, } = req.params;

				const cleanedSymbol = sanitizeSymbolQuery(isin);

				if (cleanedSymbol == "ISIN")
				{
					res.status(HTTPStatus.BAD_REQUEST).send("❌ Invalid isin passed");

					return;
				}

				const dBAsset: IStock[] = await DBHandlerStock.getStock(mySQLPool, isin);

				if (dBAsset.length > 0)
				{
					response.UpdateStockPerformed = (new Date()).getTime() - (new Date(dBAsset[0].updated_on)).getTime() >= ONE_WEEK_IN_MS

					if (!response.UpdateStockPerformed)
					{
						res.status(HTTPStatus.OK).json({
							...response,
							stock: (await DBHandlerStock.getStock(mySQLPool, isin))[0]
						});

						return;
					}

					try
					{
						await refreshAsset(mySQLPool, dBAsset[0].isin);
					}
					catch (error)
					{
						res.status(HTTPStatus.BAD_REQUEST).json({ message: error });

						return
					}

					res.status(HTTPStatus.OK).json({
						...response,
						UpdateStockPerformed: true,
						stock: (await DBHandlerStock.getStock(mySQLPool, isin))[0]
					});

					return;
				}

				res.status(HTTPStatus.OK).json({
					...response,
					processedUnknownAsset: true,
					stock: dBAsset[0]
				});
			}
			catch (error: Error | any)
			{
				if (error instanceof Error)
				{
					res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
						message: `${INTERNAL_SERVER_ERROR}: ${error.message}`,
					});

					return;
				}

				res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
					message: `${INTERNAL_SERVER_ERROR}: Unknown error`,
				});
			}
		}
	).get(
		/**
		* @desc Search for a stock in the internal DB
		* @param query {string} to search for
		*/
		"/search/:query",
		async (req: express.Request, res: express.Response) =>
		{
			const timestamp = new Date();

			let response: {
				stocks: IStock[]
			} = {
				stocks: [
				],
			};

			try
			{
				const { query, } = req.params;

				const symbol = sanitizeSymbolQuery(query);

				if (symbol == "QUERY")
				{
					res.status(HTTPStatus.BAD_REQUEST).send("❌ Invalid query passed");

					return;
				}

				response.stocks = await DBHandlerStock.getStockByLikeSymbol(mySQLPool, symbol);

				res.status(HTTPStatus.ACCEPTED).json(response);
			}
			catch (error: Error | any)
			{
				if (error instanceof Error)
				{
					res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
						message: `${INTERNAL_SERVER_ERROR}: ${error.message}`,
					});

					return;
				}

				res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
					message: `${INTERNAL_SERVER_ERROR}: Unknown error`,
				});
			}
		}
	).get(
		/**
		* @desc Search for a stock from the external source
		* @param query {string} to search for
		*/
		"/search-external/:query",
		async (req: express.Request, res: express.Response) =>
		{
			let response: {
				stocks: any[]
			} = {
				stocks: [
				],
			};

			try
			{
				const { query, } = req.params;

				const symbol = sanitizeSymbolQuery(query);

				if (symbol == "QUERY")
				{
					res.status(HTTPStatus.BAD_REQUEST).send("❌ Invalid query passed");

					return;
				}

				const externalSearchResults = await extAPIDataProviderStock.queryForStock(symbol);

				let filteredList = [];

				for (let i = 0; i < externalSearchResults.length; i++)
				{
					/**
					* @dev Using a try-catch because the API might return something weird
					*/

					try
					{
						if (stockExchanges.includes(externalSearchResults[i].exchange.toLowerCase()))
						{
							filteredList.push(externalSearchResults[i]);
						}
					}
					catch (error)
					{
						console.warn("Invalid element:", externalSearchResults[i]);

						continue;
					}
				}

				response.stocks = filteredList;

				res.status(HTTPStatus.ACCEPTED).json(response);
			}
			catch (error: Error | any)
			{
				if (error instanceof Error)
				{
					res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
						message: `${INTERNAL_SERVER_ERROR}: ${error.message}`,
					});

					return;
				}

				res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
					message: `${INTERNAL_SERVER_ERROR}: Unknown error`,
				});
			}
		}
	).post(
		/**
		* @desc Create stock
		* @route POST /api/stock/create
		* @param symbol {string}
		*/
		"/create",
		async (req: express.Request, res: express.Response) =>
		{
			try
			{
				const { symbol, } = req.body;

				const dBAsset: IStock[] = await DBHandlerStock.getStockBySymbol(mySQLPool, symbol);

				if (dBAsset.length == 0)
				{
					try
					{
						await processNewAsset(mySQLPool, symbol);
					}
					catch (error)
					{
						res.status(HTTPStatus.BAD_REQUEST).json({ message: error });

						return;
					}

					res.status(HTTPStatus.CREATED).json({
						message: "✅ Created stock"
					});
				}
			}
			catch (error: Error | any)
			{
				if (error instanceof Error)
				{
					res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
						message: `${INTERNAL_SERVER_ERROR}: ${error.message}`,
					});

					return;
				}

				res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
					message: `${INTERNAL_SERVER_ERROR}: Unknown error`,
				});
			}
		}
	).post(
		/**
		* @route POST /api/stock/delete
		* @desc Delete assset
		* @access authorized:admin
		*/
		"/delete",
		userToken.userTokenDecodeAdmin(mySQLPool),
		loadRequired(),
		async (req: express.Request, res: express.Response) =>
		{
			const { stock_isin, }: StockDelete = req.body.load;

			try
			{
				if (!stock_isin)
				{
					res.status(HTTPStatus.BAD_REQUEST).send("Stock ID is required");
					return;
				}

				// Ensure stock exists
				const existingStock = await DBHandlerStock.getStock(mySQLPool, stock_isin);

				if ((existingStock as any[]).length === 0)
				{
					res.status(HTTPStatus.NOT_FOUND).send("Stock not found");
					return;
				}

				await DBHandlerStock.deleteStock(mySQLPool, stock_isin);

				res.status(HTTPStatus.OK).send("Deleted stock");
			}
			catch (error: Error | any)
			{
				if (error instanceof Error)
				{
					res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
						message: `${INTERNAL_SERVER_ERROR}: ${error.message}`,
					});

					return;
				}

				res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
					message: `${INTERNAL_SERVER_ERROR}: Unknown error`,
				});
			}
		}
	);
};
