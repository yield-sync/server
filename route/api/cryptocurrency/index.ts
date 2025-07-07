import express from "express";
import mysql from "mysql2";

import RouteFunctionsCryptocurrency from "./RouteFunctionsCryptocurrency";
import { INTERNAL_SERVER_ERROR, HTTPStatus } from "../../../constants";
import { loadRequired } from "../../../middleware/load";
import userToken from "../../../middleware/user-token";
import { sanitizeQuery, sanitizeSymbolQuery } from "../../../util/sanitizer";


export default (mySQLPool: mysql.Pool): express.Router =>
{
	const routeHandlerCryptocurrency: RouteFunctionsCryptocurrency = new RouteFunctionsCryptocurrency(mySQLPool);

	return express.Router().delete(
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
		* @route GET /api/cryptocurrency/
		* @desc Get all cryptocurrencies
		*/
		"/read/:id",
		async (req: express.Request, res: express.Response) =>
		{
			let response: any = {
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

				res.status(HTTPStatus.OK).json({
					...response,
					cryptocurrency: await routeHandlerCryptocurrency.readCryptocurrencyById(id),
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
	).get(
		/**
		* @desc Make internal search
		* @route GET /api/cryptocurrency/search/:query
		*/
		"/search/:query",
		async (req: express.Request, res: express.Response) =>
		{
			let response: {
				cryptocurrencies: ICryptocurrency[]
			} = {
				cryptocurrencies: [
				],
			};

			try
			{
				const { query, } = req.params;

				let searchResults = await routeHandlerCryptocurrency.searchCryptocurrencyByLikeSymbol(
					sanitizeQuery(query)
				);

				res.status(HTTPStatus.OK).json({
					...response,
					cryptocurrencies: searchResults.results,
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
	).post(
		/**
		* @desc Create cryptocurrency
		* @notice EXTERNAL source utilized
		* @route POST /api/cryptocurrency/create
		* @param coingeckoId {string} Id from coingecko that ties to the cryptocurrency
		*/
		"/create",
		loadRequired(),
		async (req: express.Request, res: express.Response) =>
		{
			try
			{
				if (!req.body.load?.id)
				{
					res.status(HTTPStatus.BAD_REQUEST).json({
						message: "No id provided",
					});

					return;
				}

				const { id, } = req.body.load;

				await routeHandlerCryptocurrency.createNewAssetById(id);

				res.status(HTTPStatus.CREATED).json({
					message: "Created cryptocurrency with provided id",
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
	).post(
		/**
		* @desc Make internal & external search
		* @access authorized:user
		* @notice EXTERNAL source utilized periodically
		* @route POST /api/cryptocurrency/search
		*/
		"/search",
		userToken.userTokenDecode(mySQLPool),
		loadRequired(),
		async (req: express.Request, res: express.Response) =>
		{
			if (!req.body.load?.query)
			{
				res.status(HTTPStatus.BAD_REQUEST).json({
					message: "No query provided",
				});

				return;
			}

			const { query, } = req.body.load;

			try
			{
				let searchResults = await routeHandlerCryptocurrency.searchCryptocurrencyByLikeSymbol(
					sanitizeQuery(query),
					true
				);

				res.status(HTTPStatus.OK).json({
					externalRequestMade: searchResults.updatedDB,
					cryptocurrencies: searchResults.results,
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
	);
};
