import express from "express";
import mysql from "mysql2";

import { loadRequired } from "../../../middleware/load";
import userToken from "../../../middleware/user-token";
import { INTERNAL_SERVER_ERROR, HTTPStatus } from "../../../constants";


export default (mySQLPool: mysql.Pool): express.Router =>
{
	return express.Router().get(
		/**
		* @route GET /api/portfolio/
		* @desc Return portfolios owned by user
		* @access User
		*/
		"/",
		userToken.userTokenDecode(mySQLPool),
		async (req: express.Request, res: express.Response) =>
		{
			try
			{
				const [
					portfolios,
				]: [
					IPortfolio[],
					FieldPacket[]
				] = await mySQLPool.promise().query<IPortfolio[]>(
					"SELECT * FROM portfolio WHERE user_id = ?;",
					[
						req.userDecoded.id,
					]
				);

				res.status(HTTPStatus.OK).json({
					portfolios,
				});

				return;
			}
			catch (error: Error | any)
			{
				if (error instanceof Error)
				{
					res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
						message: INTERNAL_SERVER_ERROR,
						error: error.message,
					});

					return;
				}

				res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
					message: INTERNAL_SERVER_ERROR,
					error: "Unknown Error",
				});
			}
		}
	).get(
		/**
		* @route GET /api/portfolio/:id
		* @desc Return single portfolio owned by user
		* @access User
		*/
		"/:id",
		userToken.userTokenDecode(mySQLPool),
		async (req: express.Request, res: express.Response) =>
		{
			try
			{
				const portfolioId = parseInt(req.params.id, 10);

				if (isNaN(portfolioId))
				{
					res.status(HTTPStatus.BAD_REQUEST).json({
						message: "Invalid portfolio id",
					});
					return;
				}

				const [
					portfolios,
				]: [
					IPortfolio[],
					FieldPacket[]
				] = await mySQLPool.promise().query<IPortfolio[]>(
					"SELECT * FROM portfolio WHERE user_id = ? AND id = ?;",
					[
						req.userDecoded.id,
						portfolioId,
					]
				);

				if (portfolios.length === 0)
				{
					res.status(HTTPStatus.NOT_FOUND).json({
						message: "Portfolio not found",
					});
					return;
				}

				const [
					portfolioAssets,
				]: [
					IPortfolioAsset[],
					FieldPacket[]
				] = await mySQLPool.promise().query<IPortfolioAsset[]>(
					`
						SELECT
							pa.id AS portfolio_asset_id,
							pa.percent_allocation,
							s.symbol AS stock_symbol,
							s.name AS stock_name,
							s.isin,
							s.exchange,
							c.symbol AS cryptocurrency_symbol,
							c.name AS cryptocurrency_name,
							c.coingecko_id
						FROM
							portfolio_asset pa
						LEFT JOIN
							stock s ON pa.stock_id = s.id
						LEFT JOIN
							cryptocurrency c ON pa.cryptocurrency_id = c.id
						WHERE
							pa.portfolio_id = ?
						;
					`,
					[
						portfolioId,
					]
				);

				res.status(HTTPStatus.OK).json({
					portfolio: portfolios[0],
					portfolioAssets,
				});
			}
			catch (error: Error | any)
			{
				if (error instanceof Error)
				{
					res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
						message: INTERNAL_SERVER_ERROR,
						error: error.message,
					});

					return;
				}

				res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
					message: INTERNAL_SERVER_ERROR,
					error: "Unknown Error",
				});
			}
		}
	).post(
		/**
		* @route POST /api/portfolio/create
		* @desc Create portfolio
		* @access User
		*/
		"/create",
		userToken.userTokenDecode(mySQLPool),
		loadRequired(),
		async (req: express.Request, res: express.Response) =>
		{
			const { name, }: PortfolioCreate = req.body.load;

			try
			{
				if (!name)
				{
					res.status(HTTPStatus.BAD_REQUEST).send("No portfolio name provided");

					return;
				}

				await mySQLPool.promise().query(
					"INSERT INTO portfolio (user_id, name) VALUES (?, ?);",
					[
						req.userDecoded.id,
						name,
					]
				);

				res.status(HTTPStatus.CREATED).send("Created portfolio");

				return;
			}
			catch (error: Error | any)
			{
				if (error instanceof Error)
				{
					res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
						message: INTERNAL_SERVER_ERROR,
						error: error.message,
					});

					return;
				}

				res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
					message: INTERNAL_SERVER_ERROR,
					error: "Unknown Error",
				});
			}
		}
	).post(
		/**
		* @route POST /api/portfolio/update
		* @desc Update portfolio
		* @access User
		*/
		"/update",
		userToken.userTokenDecode(mySQLPool),
		loadRequired(),
		async (req: express.Request, res: express.Response) =>
		{
			const { id, name, }: PortfolioUpdate = req.body.load;

			try
			{
				if (!id)
				{
					res.status(HTTPStatus.BAD_REQUEST).send("No portfolio id provided");

					return;
				}

				if (!name)
				{
					res.status(HTTPStatus.BAD_REQUEST).send("No portfolio name provided");

					return;
				}

				await mySQLPool.promise().query(
					"UPDATE portfolio SET name = ? WHERE user_id = ? AND id = ?;",
					[
						name,
						req.userDecoded.id,
						id,
					]
				);

				res.status(HTTPStatus.CREATED).send("Updated portfolio");

				return;
			}
			catch (error: Error | any)
			{
				if (error instanceof Error)
				{
					res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
						message: INTERNAL_SERVER_ERROR,
						error: error.message,
					});

					return;
				}

				res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
					message: INTERNAL_SERVER_ERROR,
					error: "Unknown Error",
				});
			}
		}
	).post(
		/**
		* @route POST /api/portfolio/delete
		* @desc Delete portfolio
		* @access User
		*/
		"/delete",
		userToken.userTokenDecode(mySQLPool),
		loadRequired(),
		async (req: express.Request, res: express.Response) =>
		{
			const { portfolio_id, }: any = req.body.load;
			try
			{
				if (!portfolio_id)
				{
					res.status(HTTPStatus.BAD_REQUEST).send("No portfolio id provided");

					return;
				}

				await mySQLPool.promise().query(
					"DELETE FROM portfolio WHERE user_id = ? AND id = ?;",
					[
						req.userDecoded.id,
						portfolio_id,
					]
				);

				res.status(HTTPStatus.CREATED).send("Deleted portfolio");

				return;
			}
			catch (error: Error | any)
			{
				if (error instanceof Error)
				{
					res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
						message: INTERNAL_SERVER_ERROR,
						error: error.message,
					});

					return;
				}

				res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
					message: INTERNAL_SERVER_ERROR,
					error: "Unknown Error",
				});
			}
		}
	);
};

