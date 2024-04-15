// [import]
import cors from "cors";
import express from "express";
import mysql from "mysql";
import { promisify } from "util";

import { user } from "../../../middleware/token";


export default (dBConnection: mysql.Connection) =>
{
	// Promisify dbConnection.query for easier use with async/await
	const DB_QUERY = promisify(dBConnection.query).bind(dBConnection);

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
				const portfolios = await DB_QUERY(
					"SELECT * FROM portfolio WHERE id = ? AND user_id = ?;",
					[load.portfolio_id, req.body.userDecoded.id],
				);

				if (portfolios.length === 0)
				{
					res.status(400).send("Invalid portfolio_id");

					return;
				}

				// Insert into portfolio_asset
				await DB_QUERY(
					"INSERT INTO portfolio_asset (portfolio_id, ticker) VALUES (?, ?);",
					[load.portfolio_id, load.ticker]
				);

				res.status(200).send("Portfolio asset created.");

				return;

			}
			catch (error)
			{
				res.status(500).send("Internal server error");

				return;
			}
		}
	);

	return router;
};

