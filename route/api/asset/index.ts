import express from "express";
import mysql from "mysql2";

import { loadRequired } from "../../../middleware/load";
import userToken from "../../../middleware/user-token";
import { INTERNAL_SERVER_ERROR, HTTPStatus } from "../../../constants";
import DBHandlerAsset from "../../../db-handler/asset";
import DBHandlerQueryAsset from "../../../db-handler/query_asset";
import { sanitizeSymbolQuery } from "../../../util/sanitizer";
import externalAPICryptocurrency from "../../../external-api/data-provider-cryptocurrency";
import externalAPIStock from "../../../external-api/data-provider-stock";


const ONE_WEEK_IN_MINUTES: number = 10080;
const ONE_WEEK_IN_MS: number = ONE_WEEK_IN_MINUTES * 60 * 1000;


const refreshAsset = async (mySQLPool: mysql.Pool, asset: IAsset) => {
	let externalAsset: IAsset;

	switch (asset.type)
	{
		case "cryptocurrency":
			externalAsset = await externalAPICryptocurrency.getCryptocurrencyProfile(asset.id);
			break;
		case "stock":
			externalAsset = await externalAPIStock.getStockProfile(asset.symbol);
			break;
		default:
			throw new Error("Unknown asset type");
	}

	if (!externalAsset)
	{
		throw new Error("Nothing returned from external source");
	}

	switch (asset.type)
	{
		case "cryptocurrency":
			break;
		case "stock":
			if (externalAsset.id != asset.id)
			{
				/**
				* @dev If this happens then it means that the the symbol now belongs to a different company.
				*/

				// Set the symbol of the dBStock to "0" (considered unknown)
				await DBHandlerAsset.markAssetSymbolUnknown(mySQLPool, asset.id);

				if ((await DBHandlerAsset.getAsset(mySQLPool, externalAsset.id)).length > 0)
				{
					// Stock with ISIN provided from external source already exists -> Update it
					await DBHandlerAsset.updateAsset(mySQLPool, externalAsset);
				}
				else
				{
					await DBHandlerAsset.createAsset(mySQLPool, externalAsset);
				}

				const externalSearchForDBStockISIN: IAsset = await externalAPIStock.queryForStockByIsin(
					asset.id
				);

				if (externalSearchForDBStockISIN)
				{
					await DBHandlerAsset.updateAsset(mySQLPool, externalSearchForDBStockISIN);
				}
				else
				{
					console.warn(`Nothing was found for ISIN "${asset.id}". symbol will remain 0`);
				}
			}
			break;
		default:
			throw new Error("Unknown asset type");
	}
}

const processNewAsset = async (mySQLPool: mysql.Pool, id: string): Promise<void> => {
	const externalCryptocurrency: IAsset = await externalAPICryptocurrency.getCryptocurrencyProfile(id);

	const externalStock: IAsset = await externalAPIStock.getStockProfile(id);

	if (!externalStock && !externalCryptocurrency)
	{
		throw new Error("Nothing found for symbol");
	}

	if (externalStock) await DBHandlerAsset.createAsset(mySQLPool, externalStock);

	if (externalCryptocurrency) await DBHandlerAsset.createAsset(mySQLPool, externalCryptocurrency);
};


export default (mySQLPool: mysql.Pool): express.Router =>
{
	return express.Router().get(
		/**
		* @desc Get asset profile
		* @param id {string}
		*/
		"/profile/:id",
		async (req: express.Request, res: express.Response) =>
		{
			let response: AssetSearchQuery = {
				processedUnknownAsset: false,
				refreshAssetRequired: false,
				asset: null,
			};

			try
			{
				const { id, } = req.params;

				const dBAsset: IAsset[] = await DBHandlerAsset.getAsset(mySQLPool, id);

				if (dBAsset.length > 0)
				{
					response.refreshAssetRequired = ONE_WEEK_IN_MS < (new Date()).getTime() - (
						new Date(dBAsset[0].refreshed)
					).getTime()

					if (!response.refreshAssetRequired)
					{
						res.status(HTTPStatus.ACCEPTED).json({
							...response,
							asset: (await DBHandlerAsset.getAsset(mySQLPool, id))[0]
						});

						return;
					}

					try
					{
						await refreshAsset(mySQLPool, dBAsset[0]);
					}
					catch (error)
					{
						res.status(HTTPStatus.BAD_REQUEST).json({ message: error });
					}
				}
				else
				{
					try
					{
						await processNewAsset(mySQLPool, id);
					}
					catch (error)
					{
						res.status(HTTPStatus.BAD_REQUEST).json({ message: error });

						return;
					}

					res.status(HTTPStatus.ACCEPTED).json({
						...response,
						processedUnknownAsset: true,
						asset: (await DBHandlerAsset.getAsset(mySQLPool, id))[0]
					});
				}
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
		* @desc Search for asset in DB
		* @param query {string}
		*/
		"/search/:query",
		async (req: express.Request, res: express.Response) =>
		{
			let response: {
				assets: IAsset[]
			} = {
				assets: [
				],
			};

			try
			{
				const { query, } = req.params;

				const symbol = sanitizeSymbolQuery(query);

				if (symbol == "QUERY")
				{
					res.status(HTTPStatus.BAD_REQUEST).send("❌ Invalid query passed");

					return;
				}

				response.assets = await DBHandlerAsset.getAssetWhereSymbolLike(mySQLPool, symbol);

				res.status(HTTPStatus.ACCEPTED).json(response);
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
		* @desc Search for a stock from the external source
		* @param query {string} to search for
		*/
		"/search-external/:query",
		async (req: express.Request, res: express.Response) =>
		{
			let response: {
				assets: IAsset[]
			} = {
				assets: [
				],
			};

			try
			{
				const { query, } = req.params;

				const symbol = sanitizeSymbolQuery(query);

				if (symbol == "QUERY")
				{
					res.status(HTTPStatus.BAD_REQUEST).send("❌ Invalid query passed");

					return;
				}

				const externalQueryResults: any[] = [
					...await externalAPIStock.queryForStock(symbol),
					...await externalAPICryptocurrency.queryForCryptocurrency(symbol)
				]


				for (let i = 0; i < externalQueryResults.length; i++)
				{
					try
					{
						if (platforms.includes(externalQueryResults[i].platform.toLowerCase()))
						{
							response.assets.push(externalQueryResults[i]);
						}
					}
					catch (error)
					{
						console.warn("Element has unsupported platform:", externalQueryResults[i]);

						continue;
					}
				}

				for (let i = 0; i < response.assets.length; i++) {
					response.assets[i];
				}

				res.status(HTTPStatus.ACCEPTED).json(response);
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
		* @route DELETE /api/stock/delete
		* @desc Delete assset
		* @access authorized:admin
		*/
		"/:id",
		userToken.userTokenDecodeAdmin(mySQLPool),
		loadRequired(),
		async (req: express.Request, res: express.Response) =>
		{
			const { id, } = req.params;

			try
			{
				if (!id)
				{
					res.status(HTTPStatus.BAD_REQUEST).send("Asset id is required");
					return;
				}

				// Ensure stock exists
				const existingStock = await DBHandlerAsset.getAsset(mySQLPool, id);

				if ((existingStock as any[]).length === 0)
				{
					res.status(HTTPStatus.NOT_FOUND).send("Stock not found");
					return;
				}

				await DBHandlerAsset.deleteAsset(mySQLPool, id);

				res.status(HTTPStatus.OK).send("Deleted stock");
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
