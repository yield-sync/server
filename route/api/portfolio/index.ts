import { Router, Request, Response } from "express";
import mysql from "mysql2";

import config from "../../../config";
import { user } from "../../../middleware/token";


export default (mySQLPool: mysql.Pool): Router =>
{
	return Router().get(
		/**
		* @route GET /api/portfolio/
		* @desc Return portfolios owned by user
		* @access authorized:user
		*/
		"/",
		user(),
		async (req: Request, res: Response) =>
		{
			try
			{
				const RES_PORTFOLIO = await mySQLPool.promise().query(
					"SELECT id, name FROM portfolio WHERE user_id = ?;",
					[req.body.userDecoded.id]
				);

				res.status(200).send(RES_PORTFOLIO[0]);

				return;
			}
			catch (error)
			{
				console.log(error);

				res.status(500).send(config.nodeENV == "production" ? "Internal server error" : error);

				return;
			}
		}
	).get(
		/**
		* @route GET /api/portfolio/create
		* @desc Create portfolio
		* @access authorized:user
		*/
		"/create",
		user(),
		async (req: Request, res: Response) =>
		{
			try
			{
				if (!req.body.load.portfolio.name)
				{
					res.status(400).send("No portfolio name provided");

					return;
				}

				await mySQLPool.promise().query(
					"INSERT INTO portfolio (user_id, name) VALUES (?, ?);",
					[req.body.userDecoded.id, req.body.load.portfolio.name],
				);

				res.status(201).send("Created portfolio");

				return;
			}
			catch (error)
			{
				res.status(500).send(config.nodeENV == "production" ? "Internal server error" : error);

				return;
			}
		}
	).get(
		/**
		* @route GET /api/portfolio/update
		* @desc Update portfolio
		* @access authorized:user
		*/
		"/update",
		user(),
		async (req: Request, res: Response) =>
		{
			try
			{
				if (!req.body.load.portfolio.id)
				{
					res.status(400).send("No portfolio id provided");

					return;
				}

				if (!req.body.load.portfolio.name)
				{
					res.status(400).send("No portfolio name provided");

					return;
				}

				await mySQLPool.promise().query(
					"UPDATE portfolio SET name = ? WHERE user_id = ? AND id = ?;",
					[req.body.load.portfolio.name, req.body.userDecoded.id, req.body.load.portfolio.id]
				);

				res.status(201).send("Updated portfolio");

				return;
			}
			catch (error)
			{
				res.status(500).send(config.nodeENV == "production" ? "Internal server error" : error);

				return;
			}
		}
	).get(
		/**
		* @route GET /api/portfolio/delete
		* @desc Delete portfolio
		* @access authorized:user
		*/
		"/delete",
		user(),
		async (req: Request, res: Response) =>
		{
			try
			{
				if (!req.body.load.portfolio_id)
				{
					res.status(400).send("No portfolio id provided");

					return;
				}

				await mySQLPool.promise().query(
					"DELETE FROM portfolio WHERE user_id = ? AND id = ?;",
					[req.body.userDecoded.id, req.body.load.portfolio_id],
				);

				res.status(201).send("Deleted portfolio");

				return;
			}
			catch (error)
			{
				res.status(500).send(config.nodeENV == "production" ? "Internal server error" : error);

				return;
			}
		}
	);
};

