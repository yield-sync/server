import express from "express";
import mysql from "mysql2";

import config from "../../../config";
import { userAdmin } from "../../../middleware/token";
import { HTTPStatus } from "../../../constants/HTTPStatus";


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
				const [assets]: [IAsset[], FieldPacket[]] = await mySQLPool.promise().query<IAsset[]>(
					"SELECT * FROM asset;", []
				);

				res.status(HTTPStatus.OK).send(assets);

				return;
			}
			catch (error)
			{
				console.log(error);

				res.status(HTTPStatus.INTERNAL_SERVER_ERROR).send(
					config.nodeENV == "production" ? "Internal server error" : error
				);

				return;
			}
		}
	).get(
		/**
		* @route GET /api/asset/create
		* @desc Create asset
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
					res.status(HTTPStatus.BAD_REQUEST).send("No asset name provided");

					return;
				}

				if (!load.symbol)
				{
					res.status(HTTPStatus.BAD_REQUEST).send("No asset symbol provided");

					return;
				}

				await mySQLPool.promise().query(
					"INSERT INTO asset (symbol, name) VALUES (?, ?);",
					[load.symbol, load.name]
				);

				res.status(HTTPStatus.CREATED).send("Created asset");

				return;
			}
			catch (error)
			{
				res.status(HTTPStatus.INTERNAL_SERVER_ERROR).send(
					config.nodeENV == "production" ? "Internal server error" : error
				);

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
					res.status(HTTPStatus.BAD_REQUEST).send("No asset_id provided");

					return;
				}

				if (!load.name)
				{
					res.status(HTTPStatus.BAD_REQUEST).send("No asset name provided");

					return;
				}

				if (!load.symbol)
					{
						res.status(HTTPStatus.BAD_REQUEST).send("No asset symbol provided");

						return;
					}

				await mySQLPool.promise().query(
					"UPDATE asset SET name = ?, symbol = ? WHERE id = ?;",
					[load.name, load.symbol, load.asset_id]
				);

				res.status(HTTPStatus.CREATED).send("Updated asset");

				return;
			}
			catch (error)
			{
				res.status(HTTPStatus.INTERNAL_SERVER_ERROR).send(
					config.nodeENV == "production" ? "Internal server error" : error
				);

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
					res.status(HTTPStatus.BAD_REQUEST).send("No asset_id provided");

					return;
				}

				await mySQLPool.promise().query("DELETE FROM asset WHERE id = ?;", [load.asset_id]);

				res.status(HTTPStatus.CREATED).send("Deleted asset");

				return;
			}
			catch (error)
			{
				res.status(HTTPStatus.INTERNAL_SERVER_ERROR).send(
					config.nodeENV == "production" ? "Internal server error" : error
				);

				return;
			}
		}
	);
};
