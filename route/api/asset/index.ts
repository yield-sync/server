// [import]
import cors from "cors";
import express from "express";
import { promisify } from "util";
import mysql from "mysql";

import config from "../../../config";
import { user, userAdmin } from "../../../middleware/token";


export default (dBConnection: mysql.Connection) =>
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
				const RES_PORTFOLIO = await DB_QUERY("SELECT * FROM asset;", [req.body.userDecoded.id]);

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
		userAdmin(),
		async (req: express.Request, res: express.Response) =>
		{
			try
			{
				if (!req.body.load.asset.name)
				{
					res.status(400).send("No asset.name provided");

					return;
				}

				await DB_QUERY("INSERT INTO asset (name) VALUES (?);", [req.body.load.asset.name]);

				res.status(201).send("Created asset");

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
		"/update",
		user(),
		async (req: express.Request, res: express.Response) =>
		{
			try
			{
				if (!req.body.load.asset.id)
				{
					res.status(400).send("No asset.id provided");

					return;
				}

				if (!req.body.load.asset.name)
				{
					res.status(400).send("No asset.name provided");

					return;
				}

				await DB_QUERY(
					"UPDATE asset SET name = ? WHERE id = ?;",
					[req.body.load.asset.name, req.body.load.asset.id]
				);

				res.status(201).send("Updated asset");

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
				if (!req.body.load.asset.id)
				{
					res.status(400).send("No asset.id provided");

					return;
				}

				await DB_QUERY(
					"DELETE FROM portfolio WHERE user_id = ? AND id = ?;",
					[req.body.userDecoded.id, req.body.load.asset.id],
				);

				res.status(201).send("Deleted asset");

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


