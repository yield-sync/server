import express from "express";
import mysql from "mysql2";

import config from "../../../config";
import { user } from "../../../middleware/token";
import { HTTPStatus } from "../../../constants/HTTPStatus";


export default (mySQLPool: mysql.Pool): express.Router =>
{
	return express.Router().get(
		/**
		* @route GET /api/portfolio/
		* @desc Return portfolios owned by user
		* @access User
		*/
		"/",
		user(),
		async (req: express.Request, res: express.Response) =>
		{
			try
			{
				const RES_PORTFOLIO = await mySQLPool.promise().query(
					"SELECT id, name FROM portfolio WHERE user_id = ?;",
					[req.body.userDecoded.id]
				);

				res.status(HTTPStatus.OK).send(RES_PORTFOLIO[0]);

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
	).get(
		/**
		* @route GET /api/portfolio/create
		* @desc Create portfolio
		* @access User
		*/
		"/create",
		user(),
		async (req: express.Request, res: express.Response) =>
		{
			const load: PortfolioCreate = req.body.load;

			try
			{
				if (!load.name)
				{
					res.status(HTTPStatus.BAD_REQUEST).send("No portfolio name provided");

					return;
				}

				await mySQLPool.promise().query(
					"INSERT INTO portfolio (user_id, name) VALUES (?, ?);",
					[req.body.userDecoded.id, load.name],
				);

				res.status(HTTPStatus.CREATED).send("Created portfolio");

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
	).get(
		/**
		* @route GET /api/portfolio/update
		* @desc Update portfolio
		* @access User
		*/
		"/update",
		user(),
		async (req: express.Request, res: express.Response) =>
		{
			const load: PortfolioUpdate = req.body.load;

			try
			{
				if (!load.id)
				{
					res.status(HTTPStatus.BAD_REQUEST).send("No portfolio id provided");

					return;
				}

				if (!load.name)
				{
					res.status(HTTPStatus.BAD_REQUEST).send("No portfolio name provided");

					return;
				}

				await mySQLPool.promise().query(
					"UPDATE portfolio SET name = ? WHERE user_id = ? AND id = ?;",
					[load.name, req.body.userDecoded.id, load.id]
				);

				res.status(HTTPStatus.CREATED).send("Updated portfolio");

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
	).get(
		/**
		* @route GET /api/portfolio/delete
		* @desc Delete portfolio
		* @access User
		*/
		"/delete",
		user(),
		async (req: express.Request, res: express.Response) =>
		{
			try
			{
				if (!req.body.load.portfolio_id)
				{
					res.status(HTTPStatus.BAD_REQUEST).send("No portfolio id provided");

					return;
				}

				await mySQLPool.promise().query(
					"DELETE FROM portfolio WHERE user_id = ? AND id = ?;",
					[req.body.userDecoded.id, req.body.load.portfolio_id],
				);

				res.status(HTTPStatus.CREATED).send("Deleted portfolio");

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

