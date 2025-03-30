import express from "express";
import mysql from "mysql2";

import { loadRequired } from "../../../middleware/load";
import userToken from "../../../middleware/user-token";
import { hTTPStatus } from "../../../constants";
import DBHandlerQueryStock from "../../../db-handler/query_stock";
import DBHandlerStock from "../../../db-handler/stock";
import { sanitizeSymbolQuery } from "../../../util/sanitizer";
import externalSource from "../../../external-api/FinancialModelingPrep";


const ONE_WEEK_IN_MINUTES: number = 10080;
const ONE_WEEK_IN_MS: number = ONE_WEEK_IN_MINUTES * 60 * 1000;


export default (mySQLPool: mysql.Pool): express.Router =>
{
	return express.Router().get(
		/**
		* @route GET /api/stock/
		* @desc Get all stock ever..?
		* @access User
		*/
		"/",
		async (req: express.Request, res: express.Response) =>
		{
			try
			{
				res.status(hTTPStatus.OK).json(await DBHandlerStock.getStock(mySQLPool));
			}
			catch (error)
			{
				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).json({ message: "Internal Server Error", error });
			}
		}
	).get(
		/**
		* @route GET /api/stock/search/:symbol
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
				refreshRequired: false,
				stocks: [
				],
			};

			try
			{
				const { query } = req.params;

				const symbol = sanitizeSymbolQuery(query);

				if (symbol == "QUERY")
				{
					res.status(hTTPStatus.BAD_REQUEST).send("Invalid query passed");

					return;
				}

				response.stocks = await DBHandlerStock.getStockBySymbol(mySQLPool, symbol);

				if (response.stocks.length == 0)
				{
					response.refreshRequired = true;

					const externalStockQueryResult = await externalSource.queryForStock(symbol);

					if (!externalStockQueryResult)
					{
						res.status(hTTPStatus.BAD_REQUEST).send("Nothing found for query");

						return;
					}

					await DBHandlerQueryStock.updateQueryStockTimestamp(mySQLPool, symbol, timestamp);

					/**
					* @dev It could be possible that the symbol is new but the company is already in the DB under an old
					* symbol and name. To solve this check if the isin is already in use. If so then update the stock
					* with that isin to have the new symbol and company name received from external source.
					*/

					const stocksWithExternalIsinId = await DBHandlerStock.getStockByIsin(
						mySQLPool,
						externalStockQueryResult.isin
					);

					if (stocksWithExternalIsinId.length == 0)
					{
						await DBHandlerStock.createStock(mySQLPool, externalStockQueryResult);
					}
					else
					{
						/**
						* @dev
						* Normally this process would require you to make sure no symbol exists already but since
						* nothing was returned before we can safely assume that an update wont have constraint errors.
						*/

						await DBHandlerStock.updateStock(
							mySQLPool,
							externalStockQueryResult.symbol,
							externalStockQueryResult.name,
							externalStockQueryResult.exchange.toLowerCase(),
							stocksWithExternalIsinId[0].id
						);
					}
				}
				else
				{
					/**
					* @dev If this part of the route is reached then the stock is already in the DB but may need
					* refreshing
					*/

					const queryStock = await DBHandlerQueryStock.getQueryStockByQuery(mySQLPool, symbol);

					const lastRefresh: Date | null = queryStock.length > 0 ? new Date(
						queryStock[0].last_refresh_timestamp
					) : null;

					response.refreshRequired = !lastRefresh || (
						timestamp.getTime() - lastRefresh.getTime()
					) >= ONE_WEEK_IN_MS;


					if (!response.refreshRequired)
					{
						response.stocks = await DBHandlerStock.getStockBySymbol(mySQLPool, symbol);

						res.status(hTTPStatus.ACCEPTED).json(response);

						return;
					}

					const externalStockQueryResult = await externalSource.queryForStock(symbol);

					if (!externalStockQueryResult)
					{
						res.status(hTTPStatus.BAD_REQUEST).send("Nothing returned from external source");

						return;
					}

					if (response.stocks[0].isin != externalStockQueryResult.isin)
					{
						/**
						* @notice If this happens then it means that the the symbol now belongs to a different company.
						*/

						await DBHandlerStock.makeStockSymbolUnknown(mySQLPool, response.stocks[0].id);

						const stockInDBWithExternalISIN = await DBHandlerStock.getStockByIsin(
							mySQLPool,
							externalStockQueryResult.isin
						);

						if (stockInDBWithExternalISIN.length == 0)
						{
							await DBHandlerStock.createStock(mySQLPool, externalStockQueryResult);
						}
						else
						{
							await DBHandlerStock.updateStockSymbolAndName(
								mySQLPool,
								externalStockQueryResult.symbol,
								externalStockQueryResult.name,
								stockInDBWithExternalISIN[0].id
							);
						}

						const externalStockQueryByIsinResult = await externalSource.queryForStockByIsin(
							response.stocks[0].isin
						);

						if (externalStockQueryByIsinResult)
						{
							await DBHandlerStock.updateStockSymbolAndName(
								mySQLPool,
								externalStockQueryByIsinResult.symbol,
								externalStockQueryByIsinResult.name,
								response.stocks[0].id
							);
						}
						else
						{
							// TODO write test to check that a stock has a symbol of 0 if it is no longer found from
							// external source.
							console.error(`Nothing was found for ${response.stocks[0].id}. Symbol will remain "0".`);
						}
					}
				}

				response.stocks = await DBHandlerStock.getStockBySymbol(mySQLPool, symbol);

				res.status(hTTPStatus.ACCEPTED).json(response);
			}
			catch (error)
			{
				console.error(error);
				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).json({ message: "Internal Server Error", error });
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
			const { stock_id, }: StockDelete = req.body.load;

			try
			{
				if (!stock_id)
				{
					res.status(hTTPStatus.BAD_REQUEST).send("Stock ID is required");
					return;
				}

				// Ensure stock exists
				const existingStock = await DBHandlerStock.getStockById(mySQLPool, stock_id);

				if ((existingStock as any[]).length === 0)
				{
					res.status(hTTPStatus.NOT_FOUND).send("Stock not found");
					return;
				}

				await DBHandlerStock.deleteStock(mySQLPool, stock_id);

				res.status(hTTPStatus.OK).send("Deleted stock");
			}
			catch (error)
			{
				console.error(error);
				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).json({ message: "Internal Server Error", error });
			}
		}
	);
};
