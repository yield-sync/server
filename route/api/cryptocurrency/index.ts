import express from "express";
import mysql from "mysql2";

import { INTERNAL_SERVER_ERROR, HTTPStatus } from "../../../constants";
import extAPIDataProviderCryptocurrency from "../../../external-api/data-provider-cryptocurrency";
import { loadRequired } from "../../../middleware/load";
import userToken from "../../../middleware/user-token";
import { sanitizeQuery, sanitizeSymbolQuery } from "../../../util/sanitizer";
import DBHandlerCrypto from "../../../db-handler/cryptocurrency";


const ONE_DAY_IN_MINUTES: number = 1440;
const ONE_DAY_IN_MS: number = ONE_DAY_IN_MINUTES * 60 * 1000;
const ONE_WEEK_IN_MINUTES: number = 10080;
const ONE_WEEK_IN_MS: number = ONE_WEEK_IN_MINUTES * 60 * 1000;


export default (mySQLPool: mysql.Pool): express.Router =>
{
	return express.Router().get(
		/**
		* @route GET /api/cryptocurrency/
		* @desc Get all cryptocurrencies
		*/
		"/read/:id",
		async (req: express.Request, res: express.Response) =>
		{
			let response: any = {
				UpdateStockPerformed: false,
				cryptocurrency: null,
				dBStockWithExSymbolFound: false,
			};

			try
			{
				const { id, } = req.params;

				const cleanedId = sanitizeSymbolQuery(id);

				if (cleanedId == "ID")
				{
					res.status(HTTPStatus.BAD_REQUEST).send("❌ Invalid id passed");

					return;
				}

				const dBAsset: ICryptocurrency[] = await DBHandlerCrypto.getCryptocurrencyById(mySQLPool, cleanedId);

				if (dBAsset.length > 0)
				{
					res.status(HTTPStatus.OK).json({
						...response,
						cryptocurrency: (await DBHandlerCrypto.getCryptocurrencyById(mySQLPool, id))[0],
					});

					return;
				}

				res.status(HTTPStatus.OK).json({
					...response,
				});
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
		* @route DELETE /api/cryptocurrency/:cryptoid
		*/
		"/:cryptoid",
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

					resJSON.externalAPIResults = await extAPIDataProviderCryptocurrency.queryForCryptocurrency(query);

					const [
						cryptocurrencyCoingeckoIds,
					]: [
						ICryptocurrency[],
						FieldPacket[]
					] = await mySQLPool.promise().query<ICryptocurrency[]>(
						"SELECT id FROM cryptocurrency WHERE symbol = ? OR name LIKE ?;",
						[
							query,
							`${query}%`,
						]
					);

					for (let i = 0; i < resJSON.externalAPIResults.length; i++)
					{
						const coingeckoCoin = resJSON.externalAPIResults[i];

						let missingInDatabase = true;

						for (let ii = 0; ii < cryptocurrencyCoingeckoIds.length; ii++)
						{
							if (coingeckoCoin.id == cryptocurrencyCoingeckoIds[ii].id)
							{
								missingInDatabase = false;
							}
						}

						if (!missingInDatabase)
						{
							continue;
						}

						await mySQLPool.promise().query(
							"INSERT INTO cryptocurrency (symbol, name, id) VALUES (?, ?, ?);",
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

			const { name, symbol, }: CryptocurrencyUpdate = req.body.load;

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
					"UPDATE cryptocurrency SET name = ?, symbol = ? WHERE id = ?;",
					[
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
