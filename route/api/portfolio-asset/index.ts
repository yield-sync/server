import express from "express";
import mysql from "mysql2";

import { loadRequired } from "../../../middleware/load";
import userToken from "../../../middleware/user-token";
import { INTERNAL_SERVER_ERROR, HTTPStatus } from "../../../constants";


export default (mySQLPool: mysql.Pool): express.Router =>
{
	return express.Router().post(
		/**
		* @route POST /api/portfolio-asset/create
		* @desc Create portofolio asset
		* @access User
		*/
		"/create",
		userToken.userTokenDecode(mySQLPool),
		loadRequired(),
		async (req: express.Request, res: express.Response) =>
		{
			const { balance, percent_allocation, portfolio_id, }: PortfolioAssetCreate = req.body.load;

			const stock_isin = req.body.load.stock_isin ?? undefined;
			const cryptocurrency_id = req.body.load.cryptocurrency_id ?? undefined;

			try
			{
				if (!stock_isin && !cryptocurrency_id)
				{
					res.status(HTTPStatus.BAD_REQUEST).send({
						message: "❓ No stock_isin or cryptocurrency_id received",
					});

					return;
				}

				if (stock_isin && cryptocurrency_id)
				{
					res.status(HTTPStatus.BAD_REQUEST).send({
						message: "❓ Both stock_isin AND cryptocurrency_id received",
					});

					return;
				}

				if (!portfolio_id)
				{
					res.status(HTTPStatus.BAD_REQUEST).send({
						message: "❓ No portfolio_id received",
					});

					return;
				}

				if (!percent_allocation && percent_allocation != 0)
				{
					res.status(HTTPStatus.BAD_REQUEST).send({
						message: "❓ No percent_allocation received",
					});

					return;
				}

				if (percent_allocation < 0 || percent_allocation > 100)
				{
					res.status(HTTPStatus.BAD_REQUEST).send({
						message: "❌ Invalid percent_allocation",
					});

					return;
				}

				if (!balance && balance != 0)
				{
					res.status(HTTPStatus.BAD_REQUEST).send({
						message: "❓ No balance received",
					});

					return;
				}

				const [
					portfolios,
				]: [
					IPortfolio[],
					FieldPacket[]
				] = await mySQLPool.promise().query(
					"SELECT * FROM portfolio WHERE id = ? AND user_id = ?;",
					[
						portfolio_id,
						req.userDecoded.id,
					]
				);

				if (!Array.isArray(portfolios))
				{
					res.status(HTTPStatus.BAD_REQUEST).send({
						message: "Expected result is not Array",
					});

					return;
				}

				if (portfolios.length == 0)
				{
					res.status(HTTPStatus.BAD_REQUEST).send({
						message: "❌ Invalid portfolio_id",
					});

					return;
				}

				// Check how many portfolios the user already has
				const [
					existing,
				] = await mySQLPool.promise().query(
					"SELECT COUNT(*) AS count FROM portfolio_asset WHERE portfolio_id = ?;",
					[
						portfolio_id,
					]
				);

				const userPortfolioAssetCount = existing[0]?.count ?? 0;

				if (userPortfolioAssetCount >= 150)
				{
					res.status(HTTPStatus.FORBIDDEN).json({
						message: "You can only create up to 150 portfolio assets per portfolio",
					});

					return;
				}

				if (stock_isin)
				{
					// Insert into portfolio_asset
					await mySQLPool.promise().query(
						`
							INSERT INTO portfolio_asset
								(portfolio_id, stock_isin, percent_allocation, balance)
							VALUES
								(?, ?, ?, ?)
							;
						`,
						[
							portfolio_id,
							stock_isin,
							percent_allocation,
							balance,
						]
					);
				}

				if (cryptocurrency_id)
				{
					// Insert into portfolio_asset
					await mySQLPool.promise().query(
						`
							INSERT INTO portfolio_asset
								(portfolio_id, cryptocurrency_id, percent_allocation, balance)
							VALUES
								(?, ?, ?, ?)
							;
						`,
						[
							portfolio_id,
							cryptocurrency_id,
							percent_allocation,
							balance,
						]
					);
				}

				res.status(HTTPStatus.CREATED).send({
					message: "Portfolio asset created",
				});

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
	).put(
		/**
		* @route PUT /api/portfolio-asset/update/:id
		* @desc Create portofolio asset
		* @access User
		*/
		"/update/:id",
		userToken.userTokenDecode(mySQLPool),
		loadRequired(),
		async (req: express.Request, res: express.Response) =>
		{
			const { id, } = req.params;

			const { balance, percent_allocation, }: PortfolioAssetUpdate = req.body.load;

			try
			{
				if (!balance && balance != 0)
				{
					res.status(HTTPStatus.BAD_REQUEST).send({
						message: "❓ No balance received",
					});

					return;
				}

				if (!percent_allocation && percent_allocation != 0)
				{
					res.status(HTTPStatus.BAD_REQUEST).send({
						message: "❓ No percent_allocation received",
					});

					return;
				}

				if (percent_allocation < 0 || percent_allocation > 10_000)
				{
					res.status(HTTPStatus.BAD_REQUEST).send({
						message: "❌ Invalid percent_allocation",
					});

					return;
				}

				// Insert into portfolio_asset
				await mySQLPool.promise().query(
					"UPDATE portfolio_asset SET balance = ?, percent_allocation = ? WHERE id = ?;",
					[
						balance,
						percent_allocation,
						id,
					]
				);

				res.status(HTTPStatus.CREATED).send({
					message: "Portfolio asset updated",
				});

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
		* @route DELETE /api/portfolio-asset/:id
		* @dev Make sure that the portfolio_asset belongs to the portfolio's owner
		*/
		"/:id",
		userToken.userTokenDecode(mySQLPool),
		async (req: express.Request, res: express.Response) =>
		{
			const { id, } = req.params;

			try
			{
				const [
					portfolio_assets,
				]: [
					IPortfolioAsset[],
					FieldPacket[]
				] = await mySQLPool.promise().query(
					"SELECT * FROM portfolio_asset WHERE id = ?;",
					[
						id,
					]
				);

				if (!Array.isArray(portfolio_assets))
				{
					res.status(HTTPStatus.BAD_REQUEST).send({
						message: "Expected result is not Array",
					});

					return;
				}

				if (portfolio_assets.length == 0)
				{
					res.status(HTTPStatus.BAD_REQUEST).send({
						message: "❌ Invalid portfolio_asset id",
					});

					return;
				}

				const [
					portfolios,
				]: [
					IPortfolio[],
					FieldPacket[]
				] = await mySQLPool.promise().query(
					"SELECT * FROM portfolio WHERE id = ? AND user_id = ?;",
					[
						portfolio_assets[0].portfolio_id,
						req.userDecoded.id,
					]
				);

				if (!Array.isArray(portfolios))
				{
					res.status(HTTPStatus.BAD_REQUEST).send({
						message: "Expected result is not Array",
					});

					return;
				}

				if (portfolios.length == 0)
				{
					res.status(HTTPStatus.BAD_REQUEST).send({
						message: "❌ No portfolio found for portfolio_asset id (Possibly not your portfolio_asset)",
					});

					return;
				}

				await mySQLPool.promise().query(
					"DELETE FROM portfolio_asset WHERE id = ?;",
					[
						id,
					]
				);

				res.status(HTTPStatus.OK).send({
					message: "Deleted portfolio_asset",
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

