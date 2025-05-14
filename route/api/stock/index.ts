import express from "express";
import mysql from "mysql2";

import { createNewAssetByIsin, createNewAssetBySymbol, refreshAsset } from "./common";
import { loadRequired } from "../../../middleware/load";
import userToken from "../../../middleware/user-token";
import { INTERNAL_SERVER_ERROR, HTTPStatus } from "../../../constants";
import DBHandlerStock from "../../../db-handler/stock";
import { sanitizeSymbolQuery } from "../../../util/sanitizer";


const ONE_WEEK_IN_MINUTES: number = 10080;
const ONE_WEEK_IN_MS: number = ONE_WEEK_IN_MINUTES * 60 * 1000;


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
				dBStockWithExSymbolFound: false,
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

				const dBAsset: IStock[] = await DBHandlerStock.getStockByIsin(mySQLPool, isin);

				if (dBAsset.length > 0)
				{
					response.UpdateStockPerformed = (
						new Date()).getTime() - (new Date(dBAsset[0].updated_on)
					).getTime() >= ONE_WEEK_IN_MS;

					if (!response.UpdateStockPerformed)
					{
						res.status(HTTPStatus.OK).json({
							...response,
							stock: (await DBHandlerStock.getStockByIsin(mySQLPool, isin))[0],
						});

						return;
					}

					try
					{
						const { dBStockWithExSymbolFound, } = await refreshAsset(mySQLPool, dBAsset[0].isin);

						res.status(HTTPStatus.OK).json({
							...response,
							UpdateStockPerformed: true,
							dBStockWithExSymbolFound,
							stock: (await DBHandlerStock.getStockByIsin(mySQLPool, isin))[0],
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

				res.status(HTTPStatus.OK).json({
					...response, stock: dBAsset[0],
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
	).post(
		/**
		* @desc Create stock
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
					const createdStock = await createNewAssetByIsin(mySQLPool, isin);

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
						message: "❌ Invalid Symbol",
					});

					return;
				}

				try
				{
					const createdStock = await createNewAssetBySymbol(mySQLPool, symbol);

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
				const existingStock = await DBHandlerStock.getStockByIsin(mySQLPool, stock_isin);

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
