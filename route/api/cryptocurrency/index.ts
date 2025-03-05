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
				let cryptocurrencies: ICryptocurrency[];

				[
					cryptocurrencies,
				] = await mySQLPool.promise().query<ICryptocurrency[]>("SELECT * FROM cryptocurrency;");

				res.status(hTTPStatus.OK).send(cryptocurrencies);

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
			const { coingeckoId, name = null, symbol = null, }: CryptocurrencyCreate = req.body.load;
			try
			{
				if (!coingeckoId)
				{
					res.status(hTTPStatus.BAD_REQUEST).send("Invalid or missing coingeckoId");
					return;
				}

				const [
					cryptocurrencyWithCoinGeckoId,
				] = await mySQLPool.promise().query(
					"SELECT id FROM cryptocurrency WHERE coingecko_id = ?;",
					[
						coingeckoId,
					]
				);

				if ((cryptocurrencyWithCoinGeckoId as any[]).length > 0)
				{
					res.status(hTTPStatus.CONFLICT).send("coingecko_id already found");
					return;
				}

				// Insert the asset
				await mySQLPool.promise().query(
					"INSERT INTO cryptocurrency (symbol, name, coingecko_id) VALUES (?, ?, ?);",
					[
						symbol,
						name,
						coingeckoId,
					]
				);

				res.status(hTTPStatus.CREATED).send("Created cryptocurrency");
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
			const { cryptoid } = req.params;

			const { coingeckoId, name, symbol }: CryptocurrencyUpdate = req.body.load;

			try
			{
				const [
					existingAsset,
				]: [
					RowDataPacket[],
					FieldPacket[]
				] = await mySQLPool.promise().query(
					"SELECT * FROM cryptocurrency WHERE id = ?;",
					[
						cryptoid,
					]
				);

				if (existingAsset.length === 0)
				{
					res.status(hTTPStatus.NOT_FOUND).send("Asset not found");
					return;
				}

				await mySQLPool.promise().query(
					"UPDATE cryptocurrency SET coingecko_id = ?, name = ?, symbol = ? WHERE id = ?;",
					[
						coingeckoId ?? existingAsset[0].coingecko_id,
						name ?? existingAsset[0].name,
						symbol ?? existingAsset[0].symbol,
						cryptoid,
					]
				);

				res.status(hTTPStatus.OK).send("Updated cryptocurrency");
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
				await mySQLPool.promise().query(
					"DELETE FROM cryptocurrency WHERE id = ?;",
					[
						cryptoid,
					]
				);

				res.status(hTTPStatus.OK).send("Deleted cryptocurrency");
			}
			catch (error)
			{
				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).send(error);
			}
		}
	);
};
