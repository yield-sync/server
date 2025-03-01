import express from "express";
import mysql from "mysql2";

import { queryStock } from "../../../external-api/FinancialModelingPrep";
import { loadRequired } from "../../../middleware/load";
import { user } from "../../../middleware/token";
import { hTTPStatus } from "../../../constants";

function cleanString(input: string): string
{
	if (!input) return "";

	// Trim, Remove special characters, and uppercase
	return input.trim().replace(/[^a-zA-Z0-9.]/g, "").toUpperCase();
}


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
			const { portfolioId, query, }: PortfolioAssetCreateByQuery = req.body.load;

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

			let cleanedQuery = cleanString(query);

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

				let externalRes: any = {
				};

				let stockId: number;

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
							externalRes.data[0].symbol,
						]
					);

					stockId = stocks[0].id;
				}

				const [
					insertionResult,
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
						insertionResult.insertId,
					]
				);

				res.status(hTTPStatus.CREATED).json({
					portfolioAsset: portfolioAssets[0],
					externalAPIResult: externalRes.data ?? null,
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

