import express from "express";
import mysql from "mysql2";

import { loadRequired } from "../../../middleware/load";
import { userAdmin } from "../../../middleware/token";
import { blockchainNetworks, hTTPStatus } from "../../../constants";


export default (mySQLPool: mysql.Pool): express.Router =>
{
	return express.Router().get(
		/**
		* @route GET /api/cryptocurrency/
		* @desc Get all cryptocurrencies
		*/
		"/",
		async (req: express.Request, res: express.Response) =>
		{
			try
			{
				let stocks: ICryptocurrency[];

				[
					stocks,
				] = await mySQLPool.promise().query<ICryptocurrency[]>("SELECT * FROM cryptocurrency;");

				res.status(hTTPStatus.OK).send(stocks);

				return;
			}
			catch (error)
			{
				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).send(error);

				return;
			}
		}
	).post(
		/**
		* @route POST /api/cryptocurrency/create
		* @desc Create asset
		* @access authorized:admin
		*/
		"/create",
		userAdmin(mySQLPool),
		loadRequired(),
		async (req: express.Request, res: express.Response) =>
		{
			const { name, symbol, network, isin, address, nativeToken, }: CryptoCreate = req.body.load;
			try
			{
				if (!network || !blockchainNetworks.includes(network))
				{
					res.status(hTTPStatus.BAD_REQUEST).send("Invalid or missing network");
					return;
				}

				if (!address && !nativeToken)
				{
					res.status(hTTPStatus.BAD_REQUEST).send("Address is required for blockchain assets.");
					return;
				}

				if (address && nativeToken)
				{
					res.status(hTTPStatus.BAD_REQUEST).send("Native tokens should not have an address.");
					return;
				}

				if (address)
				{
					const [
						assetOnNetworkAndAddress,
					] = await mySQLPool.promise().query(
						"SELECT id FROM crypto WHERE network = ? AND address = ?;",
						[
							network,
							address,
						]
					);

					if ((assetOnNetworkAndAddress as any[]).length > 0)
					{
						res.status(hTTPStatus.CONFLICT).send("Address on blockchain already exists");
						return;
					}
				}

				if (nativeToken)
				{
					const [
						assetOnNetworkNativeToken,
					] = await mySQLPool.promise().query(
						"SELECT id FROM asset WHERE network = ? AND native_token = 1;",
						[
							network,
							address,
						]
					);

					if ((assetOnNetworkNativeToken as any[]).length > 0)
					{
						res.status(hTTPStatus.CONFLICT).send("Native token on network already exists.");
						return;
					}
				}

				if (isin)
				{
					const [
						existingISIN,
					] = await mySQLPool.promise().query("SELECT id FROM crypto WHERE isin = ?;", [
						isin,
					]);
					if ((existingISIN as any[]).length > 0)
					{
						res.status(hTTPStatus.CONFLICT).send("ISIN already exists.");
						return;
					}
				}

				// Insert the asset
				await mySQLPool.promise().query(
					"INSERT INTO crypto (symbol, name, network, isin, address) VALUES (?, ?, ?, ?, ?);",
					[
						symbol,
						name,
						network,
						isin,
						address,
					]
				);

				res.status(hTTPStatus.CREATED).send("Created crypto");
			}
			catch (error)
			{
				console.log(error);
				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).send(error);
			}
		}
	).put(
		"/update/:cryptoid",
		userAdmin(mySQLPool),
		loadRequired(),
		async (req: express.Request, res: express.Response) =>
		{
			const { cryptoid, } = req.params;
			const { name, symbol, network, isin, address, }: CryptoUpdate = req.body.load;
			try
			{
				const [
					existingAsset,
				]: [
					RowDataPacket[],
					FieldPacket[]
				] = await mySQLPool.promise().query(
					"SELECT * FROM crypto WHERE id = ?;",
					[
						cryptoid,
					]
				);

				if (existingAsset.length === 0)
				{
					res.status(hTTPStatus.NOT_FOUND).send("Asset not found");
					return;
				}

				const updatedAsset = {
					name: name ?? existingAsset[0].name,
					symbol: symbol ?? existingAsset[0].symbol,
					network: network ?? existingAsset[0].network,
					isin: isin ?? existingAsset[0].isin,
					address: address ?? existingAsset[0].address,
				};

				await mySQLPool.promise().query(
					"UPDATE crypto SET name = ?, symbol = ?, network = ?, isin = ?, address = ? WHERE id = ?;",
					[
						updatedAsset.name,
						updatedAsset.symbol,
						updatedAsset.network,
						updatedAsset.isin,
						updatedAsset.address,
						cryptoid,
					]
				);

				res.status(hTTPStatus.OK).send("Updated crypto");
			}
			catch (error)
			{
				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).send(error);
			}
		}
	).delete(
		"/delete/:cryptoid",
		userAdmin(mySQLPool),
		async (req: express.Request, res: express.Response) =>
		{
			const { cryptoid, } = req.params;
			try
			{
				await mySQLPool.promise().query("DELETE FROM crypto WHERE id = ?;", [
					cryptoid,
				]);
				res.status(hTTPStatus.OK).send("Deleted crypto");
			}
			catch (error)
			{
				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).send(error);
			}
		}
	);
};
