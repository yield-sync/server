import express from "express";
import mysql from "mysql2";

import config from "../../../config";
import { userAdmin } from "../../../middleware/token";
import { hTTPStatus, allNetworks } from "../../../constants";


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
				let assets: IAsset[];

				[
					assets,
				] = await mySQLPool.promise().query<IAsset[]>("SELECT * FROM asset;");

				res.status(hTTPStatus.OK).send(assets);

				return;
			}
			catch (error)
			{
				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).send(
					config.nodeENV == "production" ? "Internal server error" : error
				);

				return;
			}
		}
	).post(
		/**
		* @route POST /api/asset/create
		* @desc Create asset
		* @access authorized:admin
		*/
		"/create",
		userAdmin(),
		async (req: express.Request, res: express.Response) =>
		{
			const { name, symbol, network, isin, address }: AssetCreate = req.body.load;

			try
			{
				if (!network || !allNetworks.includes(network))
				{
					res.status(hTTPStatus.BAD_REQUEST).send("Invalid or missing network.");

					return;
				}

				// Validate ISIN and Address based on network type
				if ([
					"nasdaq",
					"nyse",
				].includes(network) && !isin)
				{
					res.status(hTTPStatus.BAD_REQUEST).send("ISIN is required for stock assets.");
					return;
				}

				if ([
					"arbitrum",
					"base",
					"ethereum",
					"op-mainnet",
					"solana",
				].includes(network) && !address)
				{
					res.status(hTTPStatus.BAD_REQUEST).send("Address is required for blockchain assets.");
					return;
				}

				// Ensure uniqueness of ISIN and Address
				if (isin)
				{
					const [
						existingISIN,
					] = await mySQLPool.promise().query("SELECT id FROM asset WHERE isin = ?;", [
						isin,
					]);
					if ((existingISIN as any[]).length > 0)
					{
						res.status(hTTPStatus.CONFLICT).send("ISIN already exists.");
						return;
					}
				}

				if (address)
				{
					const [
						existingAddress,
					] = await mySQLPool.promise().query("SELECT id FROM asset WHERE address = ?;", [
						address,
					]);
					if ((existingAddress as any[]).length > 0)
					{
						res.status(hTTPStatus.CONFLICT).send("Address already exists.");
						return;
					}
				}

				// Insert the asset
				await mySQLPool.promise().query(
					"INSERT INTO asset (symbol, name, network, isin, address) VALUES (?, ?, ?, ?, ?);",
					[
						symbol,
						name,
						network,
						isin,
						address,
					]
				);

				res.status(hTTPStatus.CREATED).send("Created asset.");
			}
			catch (error)
			{
				console.log(error);
				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).send(
					config.nodeENV === "production" ? "Internal server error" : error
				);
			}
		}
	).post(
		/**
		* @route POST /api/asset/update
		* @desc Update an asset
		* @access Admin only
		*/
		"/update",
		userAdmin(),
		async (req: express.Request, res: express.Response) =>
		{
			const { assetId, name, symbol, network, isin, address }: AssetUpdate = req.body.load;

			try
			{
				if (!assetId)
				{
					res.status(hTTPStatus.BAD_REQUEST).send("Asset ID is required.");
					return;
				}

				let existingAsset: IAsset[];

				[
					existingAsset,
				] = await mySQLPool.promise().query<IAsset[]>(
					"SELECT * FROM asset WHERE id = ?;",
					[
						assetId,
					]
				);

				if ((existingAsset as any[]).length === 0)
				{
					res.status(hTTPStatus.NOT_FOUND).send("Asset not found.");
					return;
				}

				if (network && !allNetworks.includes(network))
				{
					res.status(hTTPStatus.BAD_REQUEST).send("Invalid network.");
					return;
				}

				if (isin)
				{
					const [
						existingISIN,
					] = await mySQLPool.promise().query(
						"SELECT id FROM asset WHERE isin = ? AND id != ?;",
						[
							isin,
							assetId,
						]
					);

					if ((existingISIN as any[]).length > 0)
					{
						res.status(hTTPStatus.CONFLICT).send("ISIN already exists.");
						return;
					}
				}

				if (address)
				{
					const [
						existingAddress,
					] = await mySQLPool.promise().query(
						"SELECT id FROM asset WHERE address = ? AND id != ?;",
						[
							address,
							assetId,
						]
					);

					if ((existingAddress as any[]).length > 0)
					{
						res.status(hTTPStatus.CONFLICT).send("Address already exists.");
						return;
					}
				}

				// Update the asset
				await mySQLPool.promise().query(
					"UPDATE asset SET name = ?, symbol = ?, network = ?, isin = ?, address = ? WHERE id = ?;",
					[
						name,
						symbol,
						network,
						isin,
						address,
						assetId,
					]
				);

				res.status(hTTPStatus.OK).send("Updated asset.");
			}
			catch (error)
			{
				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).send(
					config.nodeENV === "production" ? "Internal server error" : error
				);
			}
		}
	).post(
		/**
		* @route POST /api/asset/delete
		* @desc Delete assset
		* @access authorized:admin
		*/
		"/delete",
		userAdmin(),
		async (req: express.Request, res: express.Response) =>
		{
			const { assetId }: AssetDelete = req.body.load;

			try
			{
				if (!assetId)
				{
					res.status(hTTPStatus.BAD_REQUEST).send("Asset ID is required.");
					return;
				}

				// Ensure asset exists
				const [
					existingAsset,
				] = await mySQLPool.promise().query(
					"SELECT id FROM asset WHERE id = ?;",
					[
						assetId,
					]
				);

				if ((existingAsset as any[]).length === 0)
				{
					res.status(hTTPStatus.NOT_FOUND).send("Asset not found.");
					return;
				}

				await mySQLPool.promise().query("DELETE FROM asset WHERE id = ?;", [
					assetId,
				]);

				res.status(hTTPStatus.OK).send("Deleted asset.");
			}
			catch (error)
			{
				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).send(
					config.nodeENV === "production" ? "Internal server error" : error
				);
			}
		}
	);
};
