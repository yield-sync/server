import express from "express";
import mysql from "mysql2";

import { INTERNAL_SERVER_ERROR, HTTPStatus } from "../../../constants";
import DBHandlerSector from "../../../db-handler/DBHandlerSector";
import { loadRequired } from "../../../middleware/load";
import userToken from "../../../middleware/user-token";


export default (mySQLPool: mysql.Pool): express.Router =>
{
	let dBHandlerSector: DBHandlerSector = new DBHandlerSector(mySQLPool);

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
					any[],
					FieldPacket[]
				] = await mySQLPool.promise().query<any[]>(
					`
						SELECT
							-- Portfolio Asset
							portfolio_asset.id AS portfolio_asset_id,
							portfolio_asset.balance,
							portfolio_asset.percent_allocation,

							-- Stock
							stock.isin,
							stock.exchange,
							stock.industry,
							stock.price_on_refresh as price,

							-- Cryptocurrency
							cryptocurrency.sector,
							cryptocurrency.industry,
							cryptocurrency.id,

							-- Combined name, symbol, sector, & industry
    						COALESCE(stock.name, cryptocurrency.name) AS name,
    						COALESCE(stock.symbol, cryptocurrency.symbol) AS symbol,
							COALESCE(stock.sector, cryptocurrency.sector) AS sector,
							COALESCE(stock.industry, cryptocurrency.industry) AS industry
						FROM
							portfolio_asset
						LEFT JOIN
							stock ON portfolio_asset.stock_isin = stock.isin
						LEFT JOIN
							cryptocurrency ON portfolio_asset.cryptocurrency_id = cryptocurrency.id
						WHERE
							portfolio_asset.portfolio_id = ?
						;
					`,
					[
						portfolioId,
					]
				);

				const sectorAllocations: Record<string, number> = {
				};

				const sectors: ISector[] = await dBHandlerSector.getSectors();

				// Add up all the percent allocations by sector
				for (let i = 0; i < sectors.length; i++)
				{
					const sector: ISector = sectors[i];

					if (!(sector.sector in sectorAllocations))
					{
						sectorAllocations[sector.sector] = 0;
					}

					for (let ii = 0; ii < portfolioAssets.length; ii++)
					{
						const asset = portfolioAssets[ii];

						if (asset.sector === sector.sector)
						{
							if (sector.sector in sectorAllocations)
							{
								sectorAllocations[sector.sector] += Number(asset.percent_allocation);
							}
							else
							{
								sectorAllocations[sector.sector] = Number(asset.percent_allocation);
							}
						}
					}
				}

				res.status(HTTPStatus.OK).json({
					portfolio: portfolios[0],
					sectorAllocations,
					portfolioAssets,
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

				// Check how many portfolios the user already has
				const [
					existing,
				] = await mySQLPool.promise().query(
					"SELECT COUNT(*) AS count FROM portfolio WHERE user_id = ?;",
					[
						req.userDecoded.id,
					]
				);

				const userPortfolioCount = existing[0]?.count ?? 0;

				if (userPortfolioCount >= 5)
				{
					res.status(HTTPStatus.FORBIDDEN).json({
						message: "You can only create up to 5 portfolios",
					});

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
		* @route DELETE /api/portfolio/delete
		* @desc Delete portfolio
		* @access User
		*/
		"/delete/:portfolio_id",
		userToken.userTokenDecode(mySQLPool),
		async (req: express.Request, res: express.Response) =>
		{
			const { portfolio_id, }: any = req.params;

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

