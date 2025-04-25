import express from "express";
import mysql from "mysql2";

import { INTERNAL_SERVER_ERROR, HTTPStatus } from "../../../constants";
import externalAPI from "../../../external-api/coingecko";
import { loadRequired } from "../../../middleware/load";
import userToken from "../../../middleware/user-token";
import { sanitizeQuery } from "../../../util/sanitizer";


const ONE_DAY_IN_MINUTES: number = 1440;
const ONE_DAY_IN_MS: number = ONE_DAY_IN_MINUTES * 60 * 1000;


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

				res.status(HTTPStatus.OK).send(cryptocurrencies);

				return;
			}
			catch (error: Error | any)
			{
				if (error instanceof Error)
				{
					res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
						message: `${INTERNAL_SERVER_ERROR}: ${error.message}`,
					});

					return;
				}

				res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
					message: `${INTERNAL_SERVER_ERROR}: Unknown error`,
				});
			}
		}
	).delete(
		/**
		* @route DELETE /api/cryptocurrency/delete/:cryptoid
		*/
		"/delete/:cryptoid",
		userToken.userTokenDecodeAdmin(mySQLPool),
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

				res.status(HTTPStatus.OK).send("Deleted cryptocurrency");
			}
			catch (error: Error | any)
			{
				if (error instanceof Error)
				{
					res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
						message: `${INTERNAL_SERVER_ERROR}: ${error.message}`,
					});

					return;
				}

				res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
					message: `${INTERNAL_SERVER_ERROR}: Unknown error`,
				});
			}
		}
	).get(
		/**
		* @route POST /api/cryptocurrency/search/:query
		*/
		"/search/:query",
		userToken.userTokenDecode(mySQLPool),
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

			try
			{
				const query: string = sanitizeQuery(req.params.query);

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
					FieldPacket[]
				] = await mySQLPool.promise().query(
					"SELECT last_updated FROM profile_cryptocurrency WHERE query = ?;",
					[
						query,
					]
				);

				const lastExternalReqTimestamp = queryCryptocurrency.length > 0 ? new Date(
					queryCryptocurrency[0].last_updated
				) : null;

				resJSON.externalRequestRequired = !lastExternalReqTimestamp || (
					now.getTime() - lastExternalReqTimestamp.getTime()
				) >= ONE_DAY_IN_MS;

				if (resJSON.externalRequestRequired)
				{
					await mySQLPool.promise().query(
						`
							INSERT INTO
								profile_cryptocurrency (query, last_updated)
							VALUES
								(?, ?)
							ON DUPLICATE KEY UPDATE
								last_updated = ?
							;
						`,
						[
							query,
							now,
							now,
						]
					);

					resJSON.externalAPIResults = await externalAPI.queryForCryptocurrency(query);

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

					for (let i = 0; i < resJSON.externalAPIResults.length; i++)
					{
						const coingeckoCoin = resJSON.externalAPIResults[i];

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

				res.status(HTTPStatus.OK).json(resJSON);
			}
			catch (error: Error | any)
			{
				if (error instanceof Error)
				{
					res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
						message: `${INTERNAL_SERVER_ERROR}: ${error.message}`,
					});

					return;
				}

				res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
					message: `${INTERNAL_SERVER_ERROR}: Unknown error`,
				});
			}
		}
	).put(
		/**
		* @route PUT /api/cryptocurrency/update/:id
		*/
		"/update/:id",
		userToken.userTokenDecodeAdmin(mySQLPool),
		loadRequired(),
		async (req: express.Request, res: express.Response) =>
		{
			const { id, } = req.params;

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
						id,
					]
				);

				if (existingAsset.length === 0)
				{
					res.status(HTTPStatus.NOT_FOUND).send("Asset not found");
					return;
				}

				await mySQLPool.promise().query(
					"UPDATE cryptocurrency SET coingecko_id = ?, name = ?, symbol = ? WHERE id = ?;",
					[
						coingecko_id ?? existingAsset[0].coingecko_id,
						name ?? existingAsset[0].name,
						symbol ?? existingAsset[0].symbol,
						id,
					]
				);

				res.status(HTTPStatus.OK).send("Updated cryptocurrency");
			}
			catch (error: Error | any)
			{
				if (error instanceof Error)
				{
					res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
						message: `${INTERNAL_SERVER_ERROR}: ${error.message}`,
					});

					return;
				}

				res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
					message: `${INTERNAL_SERVER_ERROR}: Unknown error`,
				});
			}
		}
	);
};
