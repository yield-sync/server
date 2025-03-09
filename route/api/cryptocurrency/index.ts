import express from "express";
import mysql from "mysql2";

import { loadRequired } from "../../../middleware/load";
import { user, userAdmin } from "../../../middleware/token";
import { hTTPStatus } from "../../../constants";
import { queryForCryptocurrency } from "../../../external-api/coingecko";
import { sanitizeQuery } from "../../../util/sanitizer";


const EXTERNAL_CALL_DELAY_MINUTES: number = 1440;
const EXTERNAL_CALL_DELAY_MS: number = EXTERNAL_CALL_DELAY_MINUTES * 60 * 1000;


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
			const now = new Date();

			let resJSON: {
				externalRequestRequired: boolean,
				cryptocurrencies: ICryptocurrency[]
				externalAPIResults: CoingeckoCoin[]
			} = {
				externalRequestRequired: false,
				cryptocurrencies: [
				],
				externalAPIResults: [
				],
			};

			let cryptocurrencies: ICryptocurrency[] = [
			];

			const query: string = sanitizeQuery(req.params.query);

			try
			{
				[
					cryptocurrencies,
				] = await mySQLPool.promise().query<ICryptocurrency[]>(
					"SELECT * FROM cryptocurrency WHERE symbol = ? OR name LIKE ? LIMIT 10;",
					[
						query,
						`%${query}%`,
					]
				);

				const [
					queryCryptocurrency,
				]: [
					any[],
					any
				] = await mySQLPool.promise().query(
					"SELECT last_request_timestamp FROM query_cryptocurrency WHERE query = ?;",
					[
						query,
					]
				);

				const lastExternalReqTimestamp = queryCryptocurrency.length > 0 ? new Date(
					queryCryptocurrency[0].last_request_timestamp
				) : null;

				resJSON.externalRequestRequired = !lastExternalReqTimestamp || (
					now.getTime() - lastExternalReqTimestamp.getTime()
				) >= EXTERNAL_CALL_DELAY_MS;

				if (resJSON.externalRequestRequired)
				{
					await mySQLPool.promise().query(
						`
							INSERT INTO
								query_cryptocurrency (query, last_request_timestamp)
							VALUES
								(?, ?)
							ON DUPLICATE KEY UPDATE
								last_request_timestamp = ?
							;
						`,
						[
							query,
							now,
							now,
						]
					);

					const externalAPIResults: CoingeckoCoin[] = await queryForCryptocurrency(query);

					resJSON.externalAPIResults = externalAPIResults;

					const [
						cryptocurrencyCoingeckoIds,
					]: [
						ICryptocurrency[],
						FieldPacket[]
					] = await mySQLPool.promise().query<ICryptocurrency[]>(
						"SELECT coingecko_id FROM cryptocurrency WHERE symbol = ? OR name LIKE ?;",
						[
							query,
							`%${query}%`,
						]
					);

					for (let i = 0; i < externalAPIResults.length; i++)
					{
						const coingeckoCoin = externalAPIResults[i];

						let missingInDatabase = true;

						for (let ii = 0; ii < cryptocurrencyCoingeckoIds.length; ii++)
						{
							if (coingeckoCoin.id == cryptocurrencyCoingeckoIds[ii].coingecko_id)
							{
								missingInDatabase = false;
							}
						}

						if (!missingInDatabase)
						{
							continue;
						}

						await mySQLPool.promise().query(
							"INSERT INTO cryptocurrency (symbol, name, coingecko_id) VALUES (?, ?, ?);",
							[
								coingeckoCoin.symbol,
								coingeckoCoin.name,
								coingeckoCoin.id,
							]
						);
					}

					[
						cryptocurrencies,
					] = await mySQLPool.promise().query<ICryptocurrency[]>(
						"SELECT * FROM cryptocurrency WHERE symbol = ? OR name LIKE ? LIMIT 10;",
						[
							query,
							`%${query}%`,
						]
					);
				}

				resJSON.cryptocurrencies = cryptocurrencies;

				res.status(hTTPStatus.OK).json(resJSON);
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
			const { coingecko_id, name = null, symbol = null, }: CryptocurrencyCreate = req.body.load;
			try
			{
				if (!coingecko_id)
				{
					res.status(hTTPStatus.BAD_REQUEST).send("Invalid or missing coingecko_id");
					return;
				}

				const [
					cryptocurrencyWithCoinGeckoId,
				] = await mySQLPool.promise().query(
					"SELECT id FROM cryptocurrency WHERE coingecko_id = ?;",
					[
						coingecko_id,
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
						coingecko_id,
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

			const { coingecko_id, name, symbol, }: CryptocurrencyUpdate = req.body.load;

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
						coingecko_id ?? existingAsset[0].coingecko_id,
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
