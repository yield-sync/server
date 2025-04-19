import express from "express";
import mysql from "mysql2";

import { loadRequired } from "../../../middleware/load";
import userToken from "../../../middleware/user-token";
import { INTERNAL_SERVER_ERROR, HTTPStatus } from "../../../constants";
import DBHandlerQueryStock from "../../../db-handler/query_for_stock";
import DBHandlerStock from "../../../db-handler/stock";
import { sanitizeSymbolQuery } from "../../../util/sanitizer";
import externalSource from "../../../external-api/FinancialModelingPrep";


const ONE_WEEK_IN_MINUTES: number = 10080;
const ONE_WEEK_IN_MS: number = ONE_WEEK_IN_MINUTES * 60 * 1000;


export default (mySQLPool: mysql.Pool): express.Router =>
{
	return express.Router().get(
		/**
		* @route GET /api/stock/search/:symbolresponse
		* @desc Search for a stock and add it to DB if it doesnt exist
		* @param query {string} to search for
		* @access authorized:user
		*/
		"/search/:query",
		userToken.userTokenDecode(mySQLPool),
		async (req: express.Request, res: express.Response) =>
		{
			const timestamp = new Date();

			let response: StockSearchQuery = {
				processedUnknownStock: false,
				refreshRequired: false,
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

				const dBStockQueryResult: IStock[] = await DBHandlerStock.getStockBySymbol(mySQLPool, symbol);

				if (dBStockQueryResult.length > 0)
				{
					/**
					* @dev If this part of the route is reached then the stock is already in the DB but may need
					* refreshing
					*/

					const dBStock: IStock = dBStockQueryResult[0];

					const queryForStock = await DBHandlerQueryStock.getQueryForStock(mySQLPool, symbol);

					const lastRefresh: Date | null = queryForStock.length > 0 ? new Date(
						queryForStock[0].last_refresh_timestamp
					) : null;

					response.refreshRequired = !lastRefresh || (
						timestamp.getTime() - lastRefresh.getTime()
					) >= ONE_WEEK_IN_MS;

					if (response.refreshRequired)
					{
						const externalStock: IStock = await externalSource.queryForStock(symbol);

						if (!externalStock)
						{
							res.status(HTTPStatus.BAD_REQUEST).send("Nothing returned from external source");

							return;
						}

						if (externalStock.isin != dBStock.isin)
						{
							/**
							* @dev If this happens then it means that the the symbol now belongs to a different company.
							*/

							// Set the symbol of the dBStock to "0" (considered unknown)
							await DBHandlerStock.markStockSymbolUnknown(mySQLPool, dBStock.isin);

							if ((await DBHandlerStock.getStock(mySQLPool, externalStock.isin)).length > 0)
							{
								// Stock with ISIN provided from external source already exists -> Update it
								await DBHandlerStock.updateStock(mySQLPool, externalStock);
							}
							else
							{
								await DBHandlerStock.createStock(mySQLPool, externalStock);
							}

							const externalSearchForDBStockISIN: IStock = await externalSource.queryForStockByIsin(
								dBStock.isin
							);

							if (externalSearchForDBStockISIN)
							{
								await DBHandlerStock.updateStock(mySQLPool, externalSearchForDBStockISIN);
							}
							else
							{
								console.warn(`Nothing was found for ISIN "${dBStock.isin}". symbol will remain 0`);
							}
						}
					}
				}
				else
				{
					response.processedUnknownStock = true;

					const externalStock: IStock = await externalSource.queryForStock(symbol);

					if (!externalStock)
					{
						res.status(HTTPStatus.BAD_REQUEST).send("Nothing found for query in DB and External");

						return;
					}

					/**
					* @dev It could be possible that the symbol is new but the company is already in the DB under an old
					* symbol and name. To solve this check if the isin is already in use. If so then update the stock
					* with that isin to have the new symbol and company name received from external source.
					*/

					const stocksWithExternalISIN: IStock[] = await DBHandlerStock.getStock(
						mySQLPool,
						externalStock.isin
					);

					if (stocksWithExternalISIN.length > 0)
					{
						/**
						* @dev
						* Normally this process would require you to make sure no symbol exists already but since
						* nothing was returned before we can safely assume that an update wont have constraint errors.
						*/

						await DBHandlerStock.updateStock(mySQLPool, externalStock);
					}
					else
					{
						await DBHandlerStock.createStock(mySQLPool, externalStock);
					}

					await DBHandlerQueryStock.updateQueryForStockTimestamp(mySQLPool, symbol, timestamp);
				}

				response.stocks = await DBHandlerStock.getStockBySymbol(mySQLPool, symbol);

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
