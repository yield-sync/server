import axios from "axios";
import express from "express";
import mysql from "mysql2";

import config from "../../../config/index";
import { user, userAdmin } from "../../../middleware/token";
import { hTTPStatus, stockExchanges } from "../../../constants";


function cleanString(input: string): string
{
	if (!input) return "";

	// Trim, Remove special characters, and uppercase
	return input.trim().replace(/[^a-zA-Z0-9.]/g, "").toUpperCase();
}


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
		"/search/:query",
		user(mySQLPool),
		async (req: express.Request, res: express.Response) =>
		{
			const query: string = cleanString(req.params.query);

			let results: IStock[];

			try
			{
				[
					results,
				] = await mySQLPool.promise().query<IStock[]>(
					"SELECT * FROM stock WHERE symbol = ? OR name LIKE ?;",
					[
						query,
						`%${query}%`,
					]
				);

				if (results.length > 0)
				{
					res.status(hTTPStatus.ACCEPTED).json({
						asset: results[0],
					});
					return;
				}

				const { uRL, key } = config.api.financialModelingPrep;

				let externalRes;

				try
				{
					externalRes = await axios.get(
						`${uRL}/api/v3/profile/${query}?apikey=${key}`
					);
				}
				catch (error)
				{
					console.error("Error fetching external API:", error);
					res.status(hTTPStatus.INTERNAL_SERVER_ERROR).json({
						message: `Failed to fetch data from external API: ${error}`
					});
					return;
				}

				if (externalRes.data.length == 0)
				{
					res.status(hTTPStatus.NOT_FOUND).json({
						message: "Could not find stock in database OR external API"
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
					results,
				] = await mySQLPool.promise().query<IStock[]>(
					"SELECT * FROM stock WHERE symbol = ?;",
					[
						externalRes.data[0].symbol
					]
				);

				res.status(hTTPStatus.ACCEPTED).json({
					asset: results[0],
					apiResult: externalRes.data
				});
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
		async (req: express.Request, res: express.Response) =>
		{
			const { name, symbol, exchange, isin }: StockCreate = req.body.load;

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
		async (req: express.Request, res: express.Response) =>
		{
			const { stockId, exchange, isin, name, symbol, }: StockUpdate = req.body.load;

			try
			{
				if (!stockId)
				{
					res.status(hTTPStatus.BAD_REQUEST).send("stockId is required");
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
						stockId,
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
						stockId,
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
						stockId,
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
		async (req: express.Request, res: express.Response) =>
		{
			const { stockId }: StockDelete = req.body.load;

			try
			{
				if (!stockId)
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
						stockId,
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
						stockId,
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
