// [import]
import cors from "cors";
import express from "express";
import { promisify } from "util";

import { user } from "../../../middleware/token";


export default (dBConnection: any) =>
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
				if (!req.body.load.portfolio.name)
				{
					res.status(400).send("No portfolio name provided");

					return;
				}

				await DB_QUERY(
					"INSERT INTO portfolio (user_id, name) VALUES (?, ?);",
					[req.body.userDecoded.id, req.body.load.portfolio.name],
				);

				res.status(200).send("Created portfolio");

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

