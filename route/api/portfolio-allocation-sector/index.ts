import express from "express";
import mysql from "mysql2";

import { loadRequired } from "../../../middleware/load";
import userToken from "../../../middleware/user-token";
import { INTERNAL_SERVER_ERROR, HTTPStatus } from "../../../constants";


export default (mySQLPool: mysql.Pool): express.Router =>
{
	return express.Router().get(
		/**
		* @route GET /api/portfolio-allocation-sector/
		* @desc Return portfolio allocation sector API
		* @access User
		* @param {string} portfolio_id - The ID of the portfolio
		* @returns {Object} portfolio_allocation_sector - The portfolio allocation sector data
		*/
		"/:portfolio_id",
		userToken.userTokenDecode(mySQLPool),
		async (req: express.Request, res: express.Response) =>
		{
			try
			{
				if (!req.params.portfolio_id)
				{
					res.status(HTTPStatus.BAD_REQUEST).send({
						message: "❓ No portfolio_id received",
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
						req.params.portfolio_id,
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

				// If portfolio not found
				if (portfolios.length == 0)
				{
					res.status(HTTPStatus.BAD_REQUEST).send({
						message: "❌ Invalid portfolio_id",
					});

					return;
				}

				// If more than one portfolio found
				if (portfolios.length > 1)
				{
					res.status(HTTPStatus.BAD_REQUEST).send({
						message: "❌ More than one portfolio found",
					});

					return;
				}

				const [
					portfolio_allocation_sector
				]: [
					IPortfolio[],
					FieldPacket[]
				] = await mySQLPool.promise().query(
					"SELECT * FROM portfolio_allocation_sector WHERE portfolio_id = ?;",
					[
						req.params.portfolio_id,
					]
				);

				res.status(HTTPStatus.OK).json({
					message: "Portfolio allocation sector API",
					portfolio_allocation_sector,
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

				if (!req.body.load?.sector_id)
				{
					res.status(HTTPStatus.BAD_REQUEST).send({
						message: "❓ No sector_id received",
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

				// Insert into portfolio_asset
				await mySQLPool.promise().query(
					`
						INSERT INTO portfolio_allocation_sector
							(portfolio_id, percent_allocation, sector_id)
						VALUES
							(?, ?, ?)
						;
					`,
					[
						req.body.load.portfolio_id,
						req.body.load.percent_allocation,
						req.body.load.sector_id,
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

			if (!req.body.load?.percent_allocation)
			{
				res.status(HTTPStatus.BAD_REQUEST).send({
					message: "❓ No percent_allocation received",
				});

				return;
			}

			const { percent_allocation, } = req.body.load;

			try
			{
				// Check if id of portfolio_allocation_sector exists
				const [
					portfolio_allocation_sector,
				]: [
					any[],
					FieldPacket[]
				] = await mySQLPool.promise().query(
					"SELECT * FROM portfolio_allocation_sector WHERE id = ?;",
					[
						req.userDecoded.id,
					]
				);

				const portfolio_id = portfolio_allocation_sector[0].portfolio_id;

				// Check if id of portfolio_allocation_sector belongs to a portfolio that is owned by the user
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

				if (portfolios.length == 0 || portfolios.length > 1)
				{
					res.status(HTTPStatus.BAD_REQUEST).send({
						message: "❌ Invalid portfolio_id",
					});

					return;
				}

				// Update portfolio_allocation_sector
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

