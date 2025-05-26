import express from "express";
import mysql from "mysql2";

import RouteFunctionsStock from "./RouteFunctionsStock";
import { INTERNAL_SERVER_ERROR, HTTPStatus } from "../../../constants";
import DBHandlerStock from "../../../db-handler/DBHandlerStock";
import userToken from "../../../middleware/user-token";
import { sanitizeQuery, sanitizeSymbolQuery } from "../../../util/sanitizer";


const ONE_WEEK_IN_MINUTES: number = 10080;
const ONE_WEEK_IN_MS: number = ONE_WEEK_IN_MINUTES * 60 * 100


export default (mySQLPool: mysql.Pool): express.Router =>
{
	const dBHandlerStock: DBHandlerStock = new DBHandlerStock(mySQLPool);
	const routeFunctionsStock: RouteFunctionsStock = new RouteFunctionsStock(mySQLPool);

	return express.Router().delete(
		/**
		* @route DELETE /api/stock/delete
		* @desc Delete assset
		* @access authorized:admin
		*/
		"/:isin",
		userToken.userTokenDecodeAdmin(mySQLPool),
		async (req: express.Request, res: express.Response) =>
		{
			const { isin, } = req.params;

			try
			{
				if (!isin)
				{
					res.status(HTTPStatus.BAD_REQUEST).send("Stock ID is required");
					return;
				}

				// Ensure stock exists
				const existingStock = await dBHandlerStock.getStockByIsin(isin);

				if ((existingStock as any[]).length === 0)
				{
					res.status(HTTPStatus.NOT_FOUND).send("Stock not found");
					return;
				}

				await dBHandlerStock.deleteStock(isin);

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
	).get(
		/**
		* @desc Get asset profile
		* @param id {string}
		*/
		"/read/:isin",
		async (req: express.Request, res: express.Response) =>
		{
			const now: number = (new Date()).getTime();

			let response: StockSearchQuery = {
				refreshed: false,
				stock: null,
				dBStockWithExSymbolFound: false,
			};

			try
			{
				const { isin, } = req.params;

				const dBStocks: IStock[] = await dBHandlerStock.getStockByIsin(sanitizeQuery(isin));

				if (dBStocks.length == 0)
				{
					res.status(HTTPStatus.OK).json({
					...response
					});

					return;
				}

				const lastRefresh: number = (new Date(dBStocks[0].refreshed_on)).getTime();

				const updatedOverAWeekAgo: boolean = now - lastRefresh >= ONE_WEEK_IN_MS;

				if (!updatedOverAWeekAgo)
				{
					res.status(HTTPStatus.OK).json({
						...response,
						stock: (await dBHandlerStock.getStockByIsin(isin))[0],
					});

					return;
				}

				try
				{
					const { dBStockWithExSymbolFound, } = await routeFunctionsStock.refreshStock(dBStocks[0].isin);

					res.status(HTTPStatus.OK).json({
						...response,
						refreshed: true,
						dBStockWithExSymbolFound,
						stock: (await dBHandlerStock.getStockByIsin(isin))[0],
					});

					return;
				}
				catch (error)
				{
					res.status(HTTPStatus.BAD_REQUEST).json({
						message: error.message,
					});

					return;
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
	).get(
		/**
		* @desc Search for a stock in the internal DB
		* @param query {string} to search for
		*/
		"/search/:query",
		async (req: express.Request, res: express.Response) =>
		{
			let response: {
				stocks: IStock[]
			} = {
				stocks: [
				],
			};

			try
			{
				const { query, } = req.params;

				let searchResults = await dBHandlerStock.getStockByLikeSymbol(sanitizeSymbolQuery(query));

				res.status(HTTPStatus.ACCEPTED).json({
					...response,
					stocks: searchResults
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
	).post(
		/**
		* @desc Create stock
		* @notice EXTERNAL source utilized
		* @route POST /api/stock/create
		* @param isin {string}
		*/
		"/create",
		async (req: express.Request, res: express.Response) =>
		{
			try
			{
				const { isin, } = req.body.load;

				try
				{
					const createdStock = await routeFunctionsStock.createNewStockByIsin(isin);

					res.status(HTTPStatus.CREATED).json({
						message: "✅ Created stock",
						createdStock,
					});
				}
				catch (error)
				{
					res.status(HTTPStatus.BAD_REQUEST).json({
						message: error.message,
					});

					return;
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
		* @desc Create stock
		* @notice EXTERNAL source utilized
		* @route POST /api/stock/create
		* @param symbol {string}
		*/
		"/create-by-symbol",
		async (req: express.Request, res: express.Response) =>
		{
			try
			{
				const { symbol, } = req.body.load;

				if (!symbol)
				{
					res.status(HTTPStatus.BAD_REQUEST).json({
						message: "❌ No symbol provided",
					});

					return;
				}

				try
				{
					const createdStock = await routeFunctionsStock.createNewStockBySymbol(symbol);

					res.status(HTTPStatus.CREATED).json({
						message: "✅ Created stock",
						createdStock,
					});
				}
				catch (error)
				{
					res.status(HTTPStatus.BAD_REQUEST).json({
						message: error.message,
					});

					return;
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
	);
};
