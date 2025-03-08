import express from "express";
import mysql from "mysql2";

import { queryStock } from "../../../external-api/FinancialModelingPrep";
import { loadRequired } from "../../../middleware/load";
import { user } from "../../../middleware/token";
import { hTTPStatus } from "../../../constants";
import { sanitizeQuery } from "../../../util/sanitizer";


export default (mySQLPool: mysql.Pool): express.Router =>
{
	return express.Router().post(
		/**
		* @route POST /api/portfolio-asset/create
		* @desc Create portofolio asset
		* @access User
		*/
		"/create",
		user(mySQLPool),
		loadRequired(),
		async (req: express.Request, res: express.Response) =>
		{
			const { portfolioId, stockId, }: PortfolioAssetCreate = req.body.load;

			try
			{
				if (!stockId)
				{
					res.status(hTTPStatus.BAD_REQUEST).send("No stockId received");

					return;
				}

				if (!portfolioId)
				{
					res.status(hTTPStatus.BAD_REQUEST).send("No portfolioId received");

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
						portfolioId,
						req.body.userDecoded.id,
					]
				);

				if (!Array.isArray(portfolios))
				{
					res.status(hTTPStatus.BAD_REQUEST).send("Expected result is not Array");

					return;
				}

				if (portfolios.length == 0)
				{
					res.status(hTTPStatus.BAD_REQUEST).send("Invalid portfolioId");

					return;
				}

				// Insert into portfolio_asset
				await mySQLPool.promise().query(
					"INSERT INTO portfolio_asset (portfolio_id, stock_id) VALUES (?, ?);",
					[
						portfolioId,
						stockId,
					]
				);

				res.status(hTTPStatus.CREATED).send("Portfolio asset created.");

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
		* @route POST /api/portfolio-asset/create
		* @desc Create portofolio asset
		* @access User
		*/
		"/create-by-query",
		user(mySQLPool),
		loadRequired(),
		async (req: express.Request, res: express.Response) =>
		{
			const { portfolioId, query, crypto = false, }: PortfolioAssetCreateByQuery = req.body.load;

			if (!portfolioId || typeof portfolioId !== "number")
			{
				res.status(hTTPStatus.BAD_REQUEST).send("No portfolioId received");
				return;
			}

			if (!query)
			{
				res.status(hTTPStatus.BAD_REQUEST).send("No query received");
				return;
			}

			let cleanedQuery = sanitizeQuery(query);

			try
			{
				const [
					portfolios,
				]: [
					IPortfolio[],
					FieldPacket[]
				] = await mySQLPool.promise().query(
					"SELECT * FROM portfolio WHERE id = ? AND user_id = ?;",
					[
						portfolioId,
						req.body.userDecoded.id,
					]
				);

				if (portfolios.length == 0)
				{
					res.status(hTTPStatus.BAD_REQUEST).send("Invalid portfolioId");

					return;
				}

				let stockId: number;
				let cryptoId: number;

				if (crypto)
				{
					const [
						foundCryptos,
					]: [
						ICrypto[],
						FieldPacket[]
					] = await mySQLPool.promise().query<ICrypto[]>(
						"SELECT * FROM crypto WHERE symbol = ? OR name LIKE ?;",
						[
							cleanedQuery,
							`%${cleanedQuery}%`,
						]
					);

					if (foundCryptos.length > 0)
					{
						cryptoId = foundCryptos[0].id;
					}
					else
					{

					}

					res.status(hTTPStatus.BAD_REQUEST).send("Crypto not supported yet");

					return;
				}
				else
				{
					const [
						foundStocks,
					]: [
						IStock[],
						FieldPacket[]
					] = await mySQLPool.promise().query<IStock[]>(
						"SELECT * FROM stock WHERE symbol = ? OR name LIKE ?;",
						[
							cleanedQuery,
							`%${cleanedQuery}%`,
						]
					);

					if (foundStocks.length > 0)
					{
						stockId = foundStocks[0].id;
					}
					else
					{
						const externallyProvidedStockData: IStock = await queryStock(cleanedQuery);

						await mySQLPool.promise().query(
							"INSERT INTO stock (symbol, name, exchange, isin) VALUES (?, ?, ?, ?);",
							[
								externallyProvidedStockData.symbol,
								externallyProvidedStockData.name,
								externallyProvidedStockData.exchange,
								externallyProvidedStockData.isin,
							]
						);

						const [
							stocks,
						]: [
							IStock[],
							FieldPacket[]
						] = await mySQLPool.promise().query<IStock[]>(
							"SELECT * FROM stock WHERE symbol = ?;",
							[
								externallyProvidedStockData.symbol,
							]
						);

						stockId = stocks[0].id;
					}
				}

				const [
					insertionQuery,
				]: [
					any,
					FieldPacket[]
				] = await mySQLPool.promise().query(
					"INSERT INTO portfolio_asset (portfolio_id, stock_id) VALUES (?, ?);",
					[
						portfolioId,
						stockId,
					]
				);

				const [
					portfolioAssets,
				]: [
					IPortfolioAsset[],
					FieldPacket[]
				]  = await mySQLPool.promise().query(
					"SELECT * FROM portfolio_asset WHERE id = ?;",
					[
						insertionQuery.insertId,
					]
				);

				res.status(hTTPStatus.CREATED).json({
					portfolioAsset: portfolioAssets[0],
				});
			}
			catch (error)
			{
				console.error(error);
				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).send(error);

				return;
			}
		}
	);
};

