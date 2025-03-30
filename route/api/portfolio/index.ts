import express from "express";
import mysql from "mysql2";

import { loadRequired } from "../../../middleware/load";
import { user } from "../../../middleware/user-token";
import { hTTPStatus } from "../../../constants";


export default (mySQLPool: mysql.Pool): express.Router =>
{
	return express.Router().get(
		/**
		* @route GET /api/portfolio/
		* @desc Return portfolios owned by user
		* @access User
		*/
		"/",
		user(mySQLPool),
		async (req: express.Request, res: express.Response) =>
		{
			try
			{
				const [
					portfolios,
				]: [
					IPortfolio[],
					FieldPacket[]
				] = await mySQLPool.promise().query<IPortfolio[]>(
					"SELECT * FROM portfolio WHERE user_id = ?;",
					[
						req.body.userDecoded.id,
					]
				);

				res.status(hTTPStatus.OK).send(portfolios);

				return;
			}
			catch (error)
			{
				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).json({ message: "Internal Server Error", error });

				return;
			}
		}
	).post(
		/**
		* @route POST /api/portfolio/create
		* @desc Create portfolio
		* @access User
		*/
		"/create",
		user(mySQLPool),
		loadRequired(),
		async (req: express.Request, res: express.Response) =>
		{
			const { name, }: PortfolioCreate = req.body.load;

			try
			{
				if (!name)
				{
					res.status(hTTPStatus.BAD_REQUEST).send("No portfolio name provided");

					return;
				}

				await mySQLPool.promise().query(
					"INSERT INTO portfolio (user_id, name) VALUES (?, ?);",
					[
						req.body.userDecoded.id,
						name,
					]
				);

				res.status(hTTPStatus.CREATED).send("Created portfolio");

				return;
			}
			catch (error)
			{
				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).json({ message: "Internal Server Error", error });

				return;
			}
		}
	).post(
		/**
		* @route POST /api/portfolio/update
		* @desc Update portfolio
		* @access User
		*/
		"/update",
		user(mySQLPool),
		loadRequired(),
		async (req: express.Request, res: express.Response) =>
		{
			const { id, name, }: PortfolioUpdate = req.body.load;

			try
			{
				if (!id)
				{
					res.status(hTTPStatus.BAD_REQUEST).send("No portfolio id provided");

					return;
				}

				if (!name)
				{
					res.status(hTTPStatus.BAD_REQUEST).send("No portfolio name provided");

					return;
				}

				await mySQLPool.promise().query(
					"UPDATE portfolio SET name = ? WHERE user_id = ? AND id = ?;",
					[
						name,
						req.body.userDecoded.id,
						id,
					]
				);

				res.status(hTTPStatus.CREATED).send("Updated portfolio");

				return;
			}
			catch (error)
			{
				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).json({ message: "Internal Server Error", error });

				return;
			}
		}
	).post(
		/**
		* @route POST /api/portfolio/delete
		* @desc Delete portfolio
		* @access User
		*/
		"/delete",
		user(mySQLPool),
		loadRequired(),
		async (req: express.Request, res: express.Response) =>
		{
			const { portfolio_id, }: any = req.body.load;
			try
			{
				if (!portfolio_id)
				{
					res.status(hTTPStatus.BAD_REQUEST).send("No portfolio id provided");

					return;
				}

				await mySQLPool.promise().query(
					"DELETE FROM portfolio WHERE user_id = ? AND id = ?;",
					[
						req.body.userDecoded.id,
						portfolio_id,
					]
				);

				res.status(hTTPStatus.CREATED).send("Deleted portfolio");

				return;
			}
			catch (error)
			{
				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).json({ message: "Internal Server Error", error });

				return;
			}
		}
	);
};

