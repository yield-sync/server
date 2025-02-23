import express from "express";
import mysql from "mysql2";

import config from "../../../config";
import { user, userAdmin } from "../../../middleware/token";


export default (mySQLPool: mysql.Pool): express.Router =>
{
	return express.Router().get(
		/**
		* @route GET /api/asset/
		* @desc Get all asset ever..?
		* @access User
		*/
		"/",
		async (req: express.Request, res: express.Response) =>
		{
			try
			{
				const [assets]: MySQLQueryResult = await mySQLPool.promise().query("SELECT * FROM asset;", []);

				res.status(200).send(assets);

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
		* @route GET /api/asset/create
		* @desc Create asset
		user(),
		* @access authorized:admin
		*/
		"/create",
		userAdmin(),
		async (req: express.Request, res: express.Response) =>
		{
			const load: AssetCreate = req.body.load;

			try
			{
				if (!load.name)
				{
					res.status(400).send("No asset name provided");

					return;
				}

				if (!load.symbol)
				{
					res.status(400).send("No asset symbol provided");

					return;
				}

				await mySQLPool.promise().query(
					"INSERT INTO asset (symbol, name) VALUES (?, ?);",
					[load.symbol, load.name]
				);

				res.status(201).send("Created asset");

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
		* @route GET /api/asset/update
		* @desc Update assset
		* @access authorized:admin
		*/
		"/update",
		userAdmin(),
		async (req: express.Request, res: express.Response) =>
		{
			const load: AssetUpdate = req.body.load;

			try
			{
				if (!load.asset_id)
				{
					res.status(400).send("No asset_id provided");

					return;
				}

				if (!load.name)
				{
					res.status(400).send("No asset name provided");

					return;
				}

				if (!load.symbol)
					{
						res.status(400).send("No asset symbol provided");

						return;
					}

				await mySQLPool.promise().query(
					"UPDATE asset SET name = ?, symbol = ? WHERE id = ?;",
					[load.name, load.symbol, load.asset_id]
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
	).get(
		/**
		* @route GET /api/asset/delete
		* @desc Delete assset
		* @access authorized:admin
		*/
		"/delete",
		userAdmin(),
		async (req: express.Request, res: express.Response) =>
		{
			const load: AssetDelete = req.body.load;

			try
			{
				if (!load.asset_id)
				{
					res.status(400).send("No asset_id provided");

					return;
				}

				await mySQLPool.promise().query("DELETE FROM asset WHERE id = ?;", [load.asset_id]);

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
};
