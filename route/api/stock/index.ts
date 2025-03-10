import axios from "axios";
import express from "express";
import mysql from "mysql2";

import config from "../../../config/index";
import { loadRequired } from "../../../middleware/load";
import { user, userAdmin } from "../../../middleware/token";
import { hTTPStatus, stockExchanges } from "../../../constants";
import { sanitizeQuery } from "../../../util/sanitizer";


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
		* @route GET /api/stock/search/:query
		* @desc Search for a stock and add it to DB if it doesnt exist
		* @param query {string} to search for
		* @access authorized:user
		*/
		"/search/:query",
		user(mySQLPool),
		async (req: express.Request, res: express.Response) =>
		{
			/*
			* 1) Search for company in database that satisfies the query..
			* 2) If a company is found in the database AND 100 days has NOT passed from last external request update:
			*     a) Check that the ISIN matches the ISIN provided by the external source
			*         i) If matches -> Return
			*         ii) Else ->
			*             !) Store the ISIN from the database in a variable
			*             @) Update the ISIN in database to one provided by External source
			*             #) Search for company that has old ISIN From External source
			*             $) Add the company found
			* 3) Else Add the company to the database
			*/

			const now = new Date();

			let resJSON: {
				externalRequestRequired: boolean,
				stocks: IStock[]
				externalAPIResults: CoingeckoCoin[]
			} = {
				externalRequestRequired: false,
				stocks: [
				],
				externalAPIResults: [
				],
			};

			const query: string = sanitizeQuery(req.params.query);

			try
			{
				[
					resJSON.stocks,
				] = await mySQLPool.promise().query<IStock[]>(
					"SELECT * FROM stock WHERE symbol = ? OR name LIKE ?;",
					[
						query,
						`%${query}%`,
					]
				);

				const [
					queryStock,
				]: [
					any[],
					FieldPacket[]
				] = await mySQLPool.promise().query(
					"SELECT last_request_timestamp FROM query_stock WHERE query = ?;",
					[
						query,
					]
				);

				const lastExternalReqTimestamp = queryStock.length > 0 ? new Date(
					queryStock[0].last_request_timestamp
				) : null;

				resJSON.externalRequestRequired = !lastExternalReqTimestamp || (
					now.getTime() - lastExternalReqTimestamp.getTime()
				) >= EXTERNAL_CALL_DELAY_MS;


				if (resJSON.externalRequestRequired)
				{
					try
					{
						const { uRL, key, } = config.api.financialModelingPrep;

						const externalRes = await axios.get(
							`${uRL}/api/v3/profile/${query}?apikey=${key}`
						);

						if (externalRes.data.length == 0)
						{
							res.status(hTTPStatus.NOT_FOUND).json({
								message: "Could not find stock in database OR external API",
							});
							return;
						}


						await mySQLPool.promise().query(
							"INSERT INTO stock (symbol, name, exchange, isin) VALUES (?, ?, ?, ?);",
							[
								externalRes.data[0].symbol,
								externalRes.data[0].companyName,
								externalRes.data[0].exchangeShortName.toLowerCase(),
								externalRes.data[0].isin,
							]
						);

						[
							resJSON.stocks,
						] = await mySQLPool.promise().query<IStock[]>(
							"SELECT * FROM stock WHERE symbol = ?;",
							[
								externalRes.data[0].symbol,
							]
						);

						resJSON.externalAPIResults = externalRes.data;
					}
					catch (error)
					{
						console.error("Error fetching external API:", error);
						res.status(hTTPStatus.INTERNAL_SERVER_ERROR).json({
							message: `Failed to fetch data from external API: ${error}`,
						});

						return;
					}
				}

				res.status(hTTPStatus.ACCEPTED).json(resJSON);
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
