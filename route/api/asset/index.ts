import express from "express";
import mysql from "mysql2";

import config from "../../../config";
import { user, userAdmin } from "../../../middleware/token";


export default (dBConnection: mysql.Pool): express.Router =>
{
	return express.Router().get(
		/**
		* @route GET /api/asset/
		* @desc Get all asset ever..?
		* @access authorized:user
		*/
		"/",
		user(),
		async (req: express.Request, res: express.Response) =>
		{
			try
			{
				const RES_PORTFOLIO = await dBConnection.promise().query("SELECT * FROM asset;", [req.body.userDecoded.id]);

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
			try
			{
				if (!req.body.load.asset.name)
				{
					res.status(400).send("No asset.name provided");

					return;
				}

				await dBConnection.promise().query("INSERT INTO asset (name) VALUES (?);", [req.body.load.asset.name]);

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

				await dBConnection.promise().query(
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
	).get(
		/**
		* @route GET /api/asset/delete
		* @desc Delete assset
		* @access authorized
		* @access authorized:admin
		*/
		"/delete",
		userAdmin(),
		async (req: express.Request, res: express.Response) =>
		{
			try
			{
				if (!req.body.load.asset.id)
				{
					res.status(400).send("No asset.id provided");

					return;
				}

				await dBConnection.promise().query(
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
};
