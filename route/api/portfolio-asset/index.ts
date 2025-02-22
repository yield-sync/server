import { Router, Request, Response } from "express";
import mysql from "mysql2";

import config from "../../../config";
import { user } from "../../../middleware/token";


export default (mySQLPool: mysql.Pool): Router =>
{
	return Router().get(
		/**
		* @route GET /api/portfolio-asset/create
		* @desc Create portofolio asset
		* @access authorized:user
		*/
		"/create",
		user(),
		async (req: Request, res: Response) =>
		{
			try
			{
				const load = req.body.load;

				if (!load.portfolio_id)
				{
					res.status(400).send("No portfolio id received")

					return;
				}

				if (!load.ticker)
				{
					res.status(400).send("No portfolio asset ticker received")

					return;
				}

				// First determine that the portfolio belongs to the user
				const [rows] = await mySQLPool.promise().query(
					"SELECT * FROM portfolio WHERE id = ? AND user_id = ?;",
					[load.portfolio_id, req.body.userDecoded.id],
				);

				if (!Array.isArray(rows))
				{
					res.status(400).send("Expected result is not Array");

					return;
				}

				if (rows.length == 0)
				{
					res.status(400).send("Invalid portfolio_id");

					return;
				}

				// Insert into portfolio_asset
				await mySQLPool.promise().query(
					"INSERT INTO portfolio_asset (portfolio_id, ticker) VALUES (?, ?);",
					[load.portfolio_id, load.ticker]
				);

				res.status(201).send("Portfolio asset created.");

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

