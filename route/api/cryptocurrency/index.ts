import express from "express";
import mysql from "mysql2";

import { loadRequired } from "../../../middleware/load";
import { user, userAdmin } from "../../../middleware/token";
import { hTTPStatus } from "../../../constants";
import { queryCryptocurrency } from "../../../external-api/coingecko";


function cleanString(input: string): string
{
	if (!input) return "";

	// Trim, Remove special characters, and uppercase
	return input.trim().replace(/[^a-zA-Z0-9.]/g, "").toUpperCase();
}


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
	).delete(
		/**
		* @route DELETE /api/cryptocurrency/delete/:cryptoid
		*/
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
	).get(
		/**
		* @route POST /api/cryptocurrency/search/:query
		*/
		"/search/:query",
		user(mySQLPool),
		async (req: express.Request, res: express.Response) =>
		{
			const query: string = cleanString(req.params.query);

			try
			{
				let cryptocurrencies: ICryptocurrency[] = [];

				[
					cryptocurrencies,
				] = await mySQLPool.promise().query<ICryptocurrency[]>(
					"SELECT * FROM cryptocurrency WHERE symbol = ? OR name LIKE ?;",
					[
						query,
						`%${query}%`,
					]
				);
				// The current issue is that what if coingecko adds another token with the same symbol the initial insertion has already occured?

				if (cryptocurrencies.length > 0)
				{
					res.status(hTTPStatus.ACCEPTED).json({
						cryptocurrencies,
					});
					return;
				}

				const externalAPIResults = await queryCryptocurrency(query);

				if (externalAPIResults.length == 0)
				{
					res.status(hTTPStatus.NOT_FOUND).json({
						message: "Nothing found"
					});

					return;
				}

				for (let i = 0; i < externalAPIResults.length; i++)
				{
					await mySQLPool.promise().query(
						"INSERT INTO cryptocurrency (symbol, name, coingecko_id) VALUES (?, ?, ?);",
						[
							externalAPIResults[i].symbol,
							externalAPIResults[i].name,
							externalAPIResults[i].id,
						]
					);
				}

				[
					cryptocurrencies,
				] = await mySQLPool.promise().query<ICryptocurrency[]>(
					"SELECT * FROM cryptocurrency WHERE symbol = ? OR name LIKE ?;",
					[
						query,
						`%${query}%`,
					]
				);

				res.status(hTTPStatus.OK).send({
					cryptocurrencies,
					externalAPIResults
				})

				return;
			}
			catch (error)
			{
				console.error(error);
				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).send(error);
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
			const { cryptoid, } = req.params;

			const { coingeckoId, name, symbol, }: CryptocurrencyUpdate = req.body.load;

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
	);
};
