import express from "express";
import mysql from "mysql2";

import { loadRequired } from "../../../middleware/load";
import userToken from "../../../middleware/user-token";
import { INTERNAL_SERVER_ERROR, HTTPStatus } from "../../../constants";


export default (mySQLPool: mysql.Pool): express.Router =>
{
	return express.Router().post(
		/**
		* @route POST /api/portfolio-allocation-sector/create
		* @desc Create portofolio sector allocation
		* @access User
		*/
		"/create",
		userToken.userTokenDecode(mySQLPool),
		async (req: express.Request, res: express.Response) =>
		{
			try
			{
				if (!req.body.load?.portfolio_id)
				{
					res.status(HTTPStatus.BAD_REQUEST).send({
						message: "❓ No portfolio_id received",
					});

					return;
				}

				if (!req.body.load?.percent_allocation && req.body.load?.percent_allocation != 0)
				{
					res.status(HTTPStatus.BAD_REQUEST).send({
						message: "❓ No percent_allocation received",
					});

					return;
				}

				if (!req.body.load?.sector)
				{
					res.status(HTTPStatus.BAD_REQUEST).send({
						message: "❓ No sector received",
					});

					return;
				}

				if (req.body.load.percent_allocation < 0 || req.body.load.percent_allocation > 100)
				{
					res.status(HTTPStatus.BAD_REQUEST).send({
						message: "❌ Invalid percent_allocation",
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
						req.body.load.portfolio_id,
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

				// Insert into portfolio_asset
				await mySQLPool.promise().query(
					`
						INSERT INTO portfolio_allocation_sector
							(portfolio_id, percent_allocation, sector)
						VALUES
							(?, ?, ?)
						;
					`,
					[
						req.body.load.portfolio_id,
						req.body.load.percent_allocation,
						req.body.load.sector,
					]
				);


				res.status(HTTPStatus.CREATED).send({
					message: "portfolio_allocation_sector created",
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

			const { percent_allocation, } = req.body.load;

			try
			{
				if (!percent_allocation && percent_allocation != 0)
				{
					res.status(HTTPStatus.BAD_REQUEST).send({
						message: "❓ No percent_allocation received",
					});

					return;
				}

				// Insert into portfolio_asset
				await mySQLPool.promise().query(
					"UPDATE portfolio_allocation_sector SET percent_allocation = ? WHERE id = ?;",
					[
						percent_allocation,
						id,
					]
				);

				res.status(HTTPStatus.CREATED).send({
					message: "portfolio_allocation_sector updated",
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
	);
};

