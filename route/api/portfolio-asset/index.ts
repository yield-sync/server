import express from "express";
import mysql from "mysql2";

import { loadRequired } from "../../../middleware/load";
import { user } from "../../../middleware/token";
import { hTTPStatus } from "../../../constants";


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
			const { portfolio_id, stock_id, percent_allocation, }: PortfolioAssetCreate = req.body.load;

			try
			{
				if (!stock_id)
				{
					res.status(hTTPStatus.BAD_REQUEST).send("No stock_id received");

					return;
				}

				if (!portfolio_id)
				{
					res.status(hTTPStatus.BAD_REQUEST).send("No portfolio_id received");

					return;
				}

				if (!percent_allocation)
				{
					res.status(hTTPStatus.BAD_REQUEST).send("No percent_allocation received");

					return;
				}

				if (percent_allocation < 0 || percent_allocation > 10_000)
				{
					res.status(hTTPStatus.BAD_REQUEST).send("Invalid percent_allocation");

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
					res.status(hTTPStatus.BAD_REQUEST).send("Invalid portfolio_id");

					return;
				}

				// Insert into portfolio_asset
				await mySQLPool.promise().query(
					"INSERT INTO portfolio_asset (portfolio_id, stock_id, percent_allocation) VALUES (?, ?, ?);",
					[
						portfolio_id,
						stock_id,
						percent_allocation
					]
				);

				res.status(hTTPStatus.CREATED).send("Portfolio asset created");

				return;

			}
			catch (error)
			{
				console.error(error);
				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).json({ message: "Internal Server Error", error });

				return;
			}
		}
	);
};

