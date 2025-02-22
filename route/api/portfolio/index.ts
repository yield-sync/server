import express from "express";
import mysql from "mysql2";

import config from "../../../config";
import { user } from "../../../middleware/token";


export default (dBConnection: mysql.Pool): express.Router =>
{
	return express.Router().get(
		"/",
		user(),
		async (req: express.Request, res: express.Response) =>
		{
			try
			{
				const RES_PORTFOLIO = await dBConnection.promise().query(
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

				await dBConnection.promise().query(
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
		"/update",
		user(),
		async (req: express.Request, res: express.Response) =>
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

				await dBConnection.promise().query(
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

				await dBConnection.promise().query(
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

