// [import]
import cors from "cors";
import express from "express";
import { promisify } from "util";

import config from "../../../config";
import { user } from "../../../middleware/token";


export default (dBConnection: any) =>
{
	// Promisify dbConnection.query for easier use with async/await
	const DB_QUERY = promisify(dBConnection.query).bind(dBConnection);

	const router: express.Router = express.Router().use(cors());

	router.get(
		"/",
		user(),
		async (req: express.Request, res: express.Response) =>
		{
			try
			{
				const RES_PORTFOLIO = await DB_QUERY(
					"SELECT id, name FROM portfolio WHERE user_id = ?;",
					[req.body.userDecoded.id]
				);

				res.status(200).send(RES_PORTFOLIO);

				return;
			}
			catch (error)
			{
				console.log(error);

				res.status(500).send(config.nodeENV == "production" ? "Internal server error" : error);

				return;
			}
		}
	);

	router.get(
		"/create",
		user(),
		async (req: express.Request, res: express.Response) =>
		{
			try
			{
				if (!req.body.load.portfolio.name)
				{
					res.status(400).send("No portfolio name provided");

					return;
				}

				await DB_QUERY(
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
	);

	router.get(
		"/delete",
		user(),
		async (req: express.Request, res: express.Response) =>
		{
			try
			{
				if (!req.body.load.portfolio_id)
				{
					res.status(400).send("No portfolio id provided");

					return;
				}

				await DB_QUERY(
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

	return router;
};

