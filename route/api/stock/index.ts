import express from "express";
import mysql from "mysql2";

import { loadRequired } from "../../../middleware/load";
import { user, userAdmin } from "../../../middleware/token";
import { hTTPStatus, stockExchanges } from "../../../constants";
import { getStockBySymbol } from "../../../handler/stock"
import { sanitizeSymbolQuery } from "../../../util/sanitizer";
import { queryForStock, queryForStockByISIN } from "../../../external-api/FinancialModelingPrep";


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
				let stocks: IStock[];

				[
					stocks,
				] = await mySQLPool.promise().query<IStock[]>("SELECT * FROM stock;");

				res.status(hTTPStatus.OK).send(stocks);

				return;
			}
			catch (error)
			{
				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).send(error);

				return;
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

			if (!req.params.query)
			{
				res.status(hTTPStatus.BAD_REQUEST).json("No query passed");
				return;
			}

			const symbol: string = sanitizeSymbolQuery(req.params.query);

			if (symbol == "QUERY")
			{
				res.status(hTTPStatus.BAD_REQUEST).json("Invalid query passed");
				return;
			}

			let response: {
				symbol: string,
				refreshRequired: boolean,
				stocks: IStock[]
			} = {
				symbol,
				refreshRequired: false,
				stocks: [
				],
			};

			try
			{
				response.stocks = await getStockBySymbol(mySQLPool, symbol);

				// If symbol not found in DB..
				if (response.stocks.length == 0)
				{
					response.refreshRequired = true;

					const stockQueryResult = await queryForStock(symbol);

					if (!stockQueryResult)
					{
						res.status(hTTPStatus.BAD_REQUEST).json("Nothing found from external source");
						return;
					}

					// Update the timestamp of the query
					await mySQLPool.promise().query(
						`
							INSERT INTO
								query_stock (query, last_refresh_timestamp)
							VALUES
								(?, ?)
							ON DUPLICATE KEY UPDATE
								last_refresh_timestamp = ?
							;
						`,
						[symbol, timestamp, timestamp]
					);

					/**
					* @dev It could be possible that the symbol is new but the company is already in the DB under an old
					* symbol and name. To solve this check that the isin is not already in use. If so then update the
					* stock with that isin to have the new symbol and company name
					*/

					const [stocksWithExternalIsinId] = await mySQLPool.promise().query<IStock[]>(
						"SELECT id FROM stock WHERE isin = ?;",
						[
							stockQueryResult.isin,
						]
					);

					// If not found..
					if (stocksWithExternalIsinId.length == 0)
					{
						// Insert new stock
						await mySQLPool.promise().query(
							"INSERT INTO stock (symbol, name, exchange, isin) VALUES (?, ?, ?, ?);",
							[
								stockQueryResult.symbol,
								stockQueryResult.name,
								stockQueryResult.exchange.toLowerCase(),
								stockQueryResult.isin,
							]
						);
					}
					else
					{
						/**
						* @dev It would normally be required to set any existing stocks with stockQueryResult.symbol to
						* a placeholder value but since we are within a condition where nothing was found we can
						* directly update the stock without worry of constrant
						*/

						// Update the existing stock with the isin
						await mySQLPool.promise().query(
							"UPDATE stock SET name = ?, symbol = ? WHERE id = ?;",
							[
								stockQueryResult.name,
								stockQueryResult.symbol,
								stocksWithExternalIsinId[0].id,
							]
						);

					}

					response.stocks = await getStockBySymbol(mySQLPool, symbol);

					res.status(hTTPStatus.ACCEPTED).json(response);

					return;
				}

				// Something was found in the DB at this point..

				const [
					queryStock,
				]: [
					any[],
					FieldPacket[]
				] = await mySQLPool.promise().query(
					"SELECT last_refresh_timestamp FROM query_stock WHERE query = ?;",
					[
						symbol,
					]
				);

				// Compute last refresh timestamp
				const lastRefreshTimestamp = queryStock.length > 0 ? new Date(
					queryStock[0].last_refresh_timestamp
				) : null;

				// Determin if a request is required
				response.refreshRequired = !lastRefreshTimestamp || (
					timestamp.getTime() - lastRefreshTimestamp.getTime()
				) >= EXTERNAL_CALL_DELAY_MS;


				if (response.refreshRequired)
				{
					const stockQueryResult = await queryForStock(symbol);

					if (!stockQueryResult)
					{
						res.status(hTTPStatus.BAD_REQUEST).json(response);

						return;
					}

					if (response.stocks[0].isin != stockQueryResult.isin)
					{
						/**
						* @dev If this happens then it means that the the symbol now belongs to a different underlying
						* company.
						*/

						/**
						* @dev
						* 1) To prevent the UNIQUE contraint error for the next step, update the stock in the DB with
						* the id = response.stocks[0].id and do the following:
						*     a) Set the symbol to #
						*     b) Set the name to #
						*/
						await mySQLPool.promise().query(
							"UPDATE stock SET symbol = ? WHERE id = ?;",
							["0", response.stocks[0].id]
						);

						/**
						* @dev
						* 2) Query DB for existing stock that has its isin = stockQueryResult.isin, and do the
						* following:
						*     a) Set the symbol to stockQueryResult.symbol
						*     b) Set the name to stockQueryResult.name
						*     c) Set the exchange to stockQueryResult.exchange
						*/
						const [stockWithExternalISIN] = await mySQLPool.promise().query<IStock[]>(
							"SELECT * FROM stock WHERE isin = ?;",
							[
								stockQueryResult.isin,
							]
						);

						// If already exists..
						if (stockWithExternalISIN.length == 0)
						{
							// Insert the stock with new isin
							await mySQLPool.promise().query(
								"INSERT INTO stock (symbol, name, exchange, isin) VALUES (?, ?, ?, ?);",
								[
									stockQueryResult.symbol,
									stockQueryResult.name,
									stockQueryResult.exchange.toLowerCase(),
									stockQueryResult.isin,
								]
							);
						}
						else
						{
							// Update the existing stock with isin
							await mySQLPool.promise().query(
								"UPDATE stock symbol = ?, SET name = ? WHERE id = ?;",
								[
									stockQueryResult.symbol,
									stockQueryResult.name,
									stockWithExternalISIN[0].id,
								]
							);
						}

						/**
						 * @dev
						 * 4) We have to update the symbol, name, and exchange for the stock that we set symbol to "0"
						 *     a) Query external source for stock with isin of response.stocks[0].isin
						 *     b) Store the data
						*/

						// Insert new stock into DB
						const stockQueryByIsinResult = await queryForStockByISIN(response.stocks[0].isin);

						if (stockQueryByIsinResult)
						{
							/**
							* @dev
							* 5) Query DB for stock that has its isin = response.stocks[0].isin, and do the following:
							*     a) Set the symbol to stockQueryResult.symbol
							*     b) Set the name to stockQueryResult.name
							*     c) Set the exchange to stockQueryResult.exchange
							*/

							// Update the existing stock with isin
							await mySQLPool.promise().query(
								"UPDATE stock symbol = ?, SET name = ? WHERE id = ?;",
								[
									stockQueryByIsinResult.symbol,
									stockQueryByIsinResult.name,
									response.stocks[0].id,
								]
							);
						}
						else
						{
							console.error(`Nothing was found for ${response.stocks[0].id}. Symbol will remain "0".`);
						}
					}

					response.stocks = await getStockBySymbol(mySQLPool, symbol);
				}

				res.status(hTTPStatus.ACCEPTED).json(response);
				return;
			}
			catch (error)
			{
				console.error(error);
				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).send(error);
			}
		}
	).post(
		/**
		* @route POST /api/stock/create
		* @desc Create stock
		* @access authorized:admin
		*/
		"/create",
		userAdmin(mySQLPool),
		loadRequired(),
		async (req: express.Request, res: express.Response) =>
		{
			const { name, symbol, exchange, isin, }: StockCreate = req.body.load;

			try
			{
				if (!exchange || !stockExchanges.includes(exchange))
				{
					res.status(hTTPStatus.BAD_REQUEST).send("Invalid or missing exchange");

					return;
				}

				if (!isin)
				{
					res.status(hTTPStatus.BAD_REQUEST).send("ISIN is required for stock");
					return;
				}

				const [
					existingISIN,
				] = await mySQLPool.promise().query(
					"SELECT id FROM stock WHERE isin = ?;",
					[
						isin,
					]
				);

				if ((existingISIN as any[]).length > 0)
				{
					res.status(hTTPStatus.CONFLICT).send("ISIN already exists");
					return;
				}

				// Insert the stock
				await mySQLPool.promise().query(
					"INSERT INTO stock (symbol, name, exchange, isin) VALUES (?, ?, ?, ?);",
					[
						symbol,
						name,
						exchange,
						isin,
					]
				);

				res.status(hTTPStatus.CREATED).send("Created stock");
			}
			catch (error)
			{
				console.error(error);
				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).send(error);
			}
		}
	).post(
		/**
		* @route POST /api/stock/update
		* @desc Update an stock
		* @access Admin only
		*/
		"/update",
		userAdmin(mySQLPool),
		loadRequired(),
		async (req: express.Request, res: express.Response) =>
		{
			const { stock_id, exchange, isin, name, symbol, }: StockUpdate = req.body.load;

			try
			{
				if (!stock_id)
				{
					res.status(hTTPStatus.BAD_REQUEST).send("stock_id is required");
					return;
				}

				if (!exchange || !stockExchanges.includes(exchange))
				{
					res.status(hTTPStatus.BAD_REQUEST).send("Invalid or missing exchange");

					return;
				}

				if (!isin)
				{
					res.status(hTTPStatus.BAD_REQUEST).send("ISIN is required for stock");
					return;
				}

				let existingStock: IStock[];

				[
					existingStock,
				] = await mySQLPool.promise().query<IStock[]>(
					"SELECT * FROM stock WHERE id = ?;",
					[
						stock_id,
					]
				);

				if ((existingStock as any[]).length === 0)
				{
					res.status(hTTPStatus.NOT_FOUND).send("Stock not found");
					return;
				}

				const [
					existingISIN,
				] = await mySQLPool.promise().query(
					"SELECT id FROM stock WHERE isin = ? AND id != ?;",
					[
						isin,
						stock_id,
					]
				);

				if ((existingISIN as any[]).length > 0)
				{
					res.status(hTTPStatus.CONFLICT).send("ISIN already exists");
					return;
				}

				await mySQLPool.promise().query(
					"UPDATE stock SET name = ?, symbol = ?, exchange = ?, isin = ? WHERE id = ?;",
					[
						name,
						symbol,
						exchange,
						isin,
						stock_id,
					]
				);

				res.status(hTTPStatus.OK).send("Updated stock");
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
				const [
					existingStock,
				] = await mySQLPool.promise().query(
					"SELECT id FROM stock WHERE id = ?;",
					[
						stock_id,
					]
				);

				if ((existingStock as any[]).length === 0)
				{
					res.status(hTTPStatus.NOT_FOUND).send("Stock not found");
					return;
				}

				await mySQLPool.promise().query(
					"DELETE FROM stock WHERE id = ?;",
					[
						stock_id,
					]
				);

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
