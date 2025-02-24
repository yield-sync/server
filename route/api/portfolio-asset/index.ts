import express from "express";
import mysql from "mysql2";

import config from "../../../config";
import { user } from "../../../middleware/token";
import { HTTPStatus } from "../../../constants/HTTPStatus";


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
				if (!load.assetId)
				{
					res.status(HTTPStatus.BAD_REQUEST).send("No assetId received");

					return;
				}

				if (!load.portfolio_id)
				{
					res.status(HTTPStatus.BAD_REQUEST).send("No portfolio_id received");

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
					res.status(HTTPStatus.BAD_REQUEST).send("Expected result is not Array");

					return;
				}

				if (portfolios.length == 0)
				{
					res.status(HTTPStatus.BAD_REQUEST).send("Invalid portfolio_id");

					return;
				}

				// Insert into portfolio_asset
				await mySQLPool.promise().query(
					"INSERT INTO portfolio_asset (portfolio_id, assetId) VALUES (?, ?);",
					[
						load.portfolio_id,
						load.assetId,
					]
				);

				res.status(HTTPStatus.CREATED).send("Portfolio asset created.");

				return;

			}
			catch (error)
			{
				res.status(HTTPStatus.INTERNAL_SERVER_ERROR).send(
					config.nodeENV == "production" ? "Internal server error" : error
				);

				return;
			}
		}
	);
};

