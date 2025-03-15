import express from "express";
import mysql from "mysql2";

import { loadRequired } from "../../../middleware/load";
import { user, userAdmin } from "../../../middleware/token";
import { hTTPStatus } from "../../../constants";
import DBHandlerQueryStock from "../../../db-handler/query_stock";
import DBHandlerStock from "../../../db-handler/stock";
import { sanitizeSymbolQuery } from "../../../util/sanitizer";
import externalSource from "../../../external-api/FinancialModelingPrep";


const EXTERNAL_CALL_DELAY_MINUTES: number = 144000;
const EXTERNAL_CALL_DELAY_MS: number = EXTERNAL_CALL_DELAY_MINUTES * 60 * 1000;


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
				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).send(error);
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
		user(mySQLPool),
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
				const symbol: string = sanitizeSymbolQuery(req.params.query);

				if (symbol == "QUERY")
				{
					res.status(hTTPStatus.BAD_REQUEST).send("Invalid query passed");

					return;
				}

				response.stocks = await DBHandlerStock.getStockBySymbol(mySQLPool, symbol);

				if (response.stocks.length == 0)
				{
					response.refreshRequired = true;

					const stockQueryResult = await externalSource.queryForStock(symbol);

					if (!stockQueryResult)
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
						stockQueryResult.isin
					);

					if (stocksWithExternalIsinId.length == 0)
					{
						await DBHandlerStock.createStock(mySQLPool, stockQueryResult);
					}
					else
					{
						await DBHandlerStock.updateStock(
							mySQLPool,
							stockQueryResult.name,
							stockQueryResult.symbol,
							stockQueryResult.exchange.toLowerCase(),
							stocksWithExternalIsinId[0].id
						);
					}


					response.stocks = await DBHandlerStock.getStockBySymbol(mySQLPool, symbol);

					res.status(hTTPStatus.ACCEPTED).json(response);

					return;
				}

				/**
				* @dev If this part of the route is reached then the stock is already in the DB and may need refreshing
				*/

				const queryStock = await DBHandlerQueryStock.getQueryStockByQuery(mySQLPool, symbol);

				const lastRefreshTimestamp = queryStock.length > 0 ? new Date(
					queryStock[0].last_refresh_timestamp
				) : null;

				response.refreshRequired = !lastRefreshTimestamp || (
					timestamp.getTime() - lastRefreshTimestamp.getTime()
				) >= EXTERNAL_CALL_DELAY_MS;


				if (!response.refreshRequired)
				{
					response.stocks = await DBHandlerStock.getStockBySymbol(mySQLPool, symbol);

					res.status(hTTPStatus.ACCEPTED).json(response);

					return;
				}

				const stockQueryResult = await externalSource.queryForStock(symbol);

				if (!stockQueryResult)
				{
					res.status(hTTPStatus.BAD_REQUEST).send("Nothing returned from external source");

					return;
				}

				if (response.stocks[0].isin != stockQueryResult.isin)
				{
					/**
					* @notice If this happens then it means that the the symbol now belongs to a different company.
					*/

					await DBHandlerStock.makeStockSymbolUnknown(mySQLPool, response.stocks[0].id);

					const stockInDBWithExternalISIN = await DBHandlerStock.getStockByIsin(
						mySQLPool,
						stockQueryResult.isin
					);

					if (stockInDBWithExternalISIN.length == 0)
					{
						await DBHandlerStock.createStock(mySQLPool, stockQueryResult);
					}
					else
					{
						await DBHandlerStock.updateStockSymbolAndName(
							mySQLPool,
							stockQueryResult.symbol,
							stockQueryResult.name,
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
						console.error(`Nothing was found for ${response.stocks[0].id}. Symbol will remain "0".`);
					}
				}

				response.stocks = await DBHandlerStock.getStockBySymbol(mySQLPool, symbol);

				res.status(hTTPStatus.ACCEPTED).json(response);
			}
			catch (error)
			{
				console.error(error);
				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).send(error);
			}
		}
	).post(
		/**
		* @route POST /api/stock/delete
		* @desc Delete assset
		* @access authorized:admin
		*/
		"/delete",
		userAdmin(mySQLPool),
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
				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).send(error);
			}
		}
	);
};
