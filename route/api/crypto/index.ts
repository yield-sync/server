import express from "express";
import mysql from "mysql2";

import { userAdmin } from "../../../middleware/token";
import { blockchainNetworks, hTTPStatus } from "../../../constants";


export default (mySQLPool: mysql.Pool): express.Router =>
{
	return express.Router().get(
		/**
		* @route GET /api/stock/
		* @desc Get all asset ever..?
		* @access User
		*/
		"/",
		async (req: express.Request, res: express.Response) =>
		{
			try
			{
				let stocks: IStock[];

				[
					stocks,
				] = await mySQLPool.promise().query<IStock[]>("SELECT * FROM asset;");

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
		* @route POST /api/stock/create
		* @desc Create asset
		* @access authorized:admin
		*/
		"/create",
		userAdmin(),
		async (req: express.Request, res: express.Response) =>
		{
			const { name, symbol, network, isin, address, native_token }: CryptoCreate = req.body.load;

			try
			{
				if (!network || !blockchainNetworks.includes(network))
				{
					res.status(hTTPStatus.BAD_REQUEST).send("Invalid or missing network");

					return;
				}

				if (!address && !native_token)
				{
					res.status(hTTPStatus.BAD_REQUEST).send("Address is required for blockchain assets.");
					return;
				}

				if (address && native_token)
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

				if (native_token)
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
	);
};
