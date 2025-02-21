// [import]
import cors from "cors";
import express from "express";
import mysql from "mysql2";

import config from "../../../config";
import { user } from "../../../middleware/token";


export default (dBConnection: mysql.Pool) =>
{
	const router: express.Router = express.Router().use(cors());

	router.get(
		"/create",
		user(),
		async (req: express.Request, res: express.Response) =>
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
				const [rows] = await dBConnection.promise().query(
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
				await dBConnection.promise().query(
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

	return router;
};

