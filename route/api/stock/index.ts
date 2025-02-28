import express from "express";
import mysql from "mysql2";

import { userAdmin } from "../../../middleware/token";
import { hTTPStatus, stockExchanges } from "../../../constants";


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
	).post(
		/**
		* @route POST /api/stock/create
		* @desc Create stock
		* @access authorized:admin
		*/
		"/create",
		userAdmin(),
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
				console.log(error)
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
		userAdmin(),
		async (req: express.Request, res: express.Response) =>
		{
			const { stockId, exchange, isin, name, symbol, }: StockUpdate = req.body.load;

			try
			{
				if (!stockId)
				{
					res.status(hTTPStatus.BAD_REQUEST).send("stockId is required.");
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
					res.status(hTTPStatus.NOT_FOUND).send("Stock not found.");
					return;
				}

				if (!exchange && !stockExchanges.includes(exchange))
				{
					res.status(hTTPStatus.BAD_REQUEST).send("Invalid exchange.");
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
					res.status(hTTPStatus.CONFLICT).send("ISIN already exists.");
					return;
				}


				const [
					existingAddress,
				] = await mySQLPool.promise().query(
					"SELECT id FROM stock WHERE address = ? AND id != ?;",
					[
						exchange,
						stockId,
					]
				);

				if ((existingAddress as any[]).length > 0)
				{
					res.status(hTTPStatus.CONFLICT).send("Address already exists.");
					return;
				}

				// Update the stock
				await mySQLPool.promise().query(
					"UPDATE stock SET name = ?, symbol = ?, network = ?, isin = ?, address = ? WHERE id = ?;",
					[
						name,
						symbol,
						exchange,
						isin,
						stockId,
					]
				);

				res.status(hTTPStatus.OK).send("Updated stock.");
			}
			catch (error)
			{
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
		userAdmin(),
		async (req: express.Request, res: express.Response) =>
		{
			const { stockId }: StockDelete = req.body.load;

			try
			{
				if (!stockId)
				{
					res.status(hTTPStatus.BAD_REQUEST).send("Stock ID is required.");
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
					res.status(hTTPStatus.NOT_FOUND).send("Stock not found.");
					return;
				}

				await mySQLPool.promise().query("DELETE FROM stock WHERE id = ?;", [
					stockId,
				]);

				res.status(hTTPStatus.OK).send("Deleted stock.");
			}
			catch (error)
			{
				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).send(error);
			}
		}
	);
};
