import express from "express";
import mysql from "mysql2";

import config from "../../../config";
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
		user(),
		async (req: express.Request, res: express.Response) =>
		{
			const load: PortfolioAssetCreate = req.body.load;

			try
			{
				if (!load.stockId)
				{
					res.status(hTTPStatus.BAD_REQUEST).send("No stockId received");

					return;
				}

				if (!load.portfolio_id)
				{
					res.status(hTTPStatus.BAD_REQUEST).send("No portfolio_id received");

					return;
				}

				// First determine that the portfolio belongs to the user
				const [
					portfolios,]:
MySQLQueryResult = await mySQLPool.promise().query(
	"SELECT * FROM portfolio WHERE id = ? AND user_id = ?;",
	[
		load.portfolio_id,
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
					"INSERT INTO portfolio_asset (portfolio_id, stockId) VALUES (?, ?);",
					[
						load.portfolio_id,
						load.stockId,
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
	);
};

