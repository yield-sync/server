import express from "express";
import mysql from "mysql2";

import config from "../config";
import { INTERNAL_SERVER_ERROR, HTTPStatus } from "../constants";


const jwt = require("jsonwebtoken");


const { secretKey, } = config.app;


function _verifyJWT(token: string): any | null
{
	try
	{
		if (!token?.startsWith("Bearer "))
		{
			return null;
		}

		const tokenBody = token.slice(7).trim();

		return jwt.verify(tokenBody, secretKey);
	}
	catch (error)
	{
		// Token is invalid or expired
		return null;
	}
}

function _creationOverFiveDays(created: Date): boolean
{
	const now = new Date();

	const fiveDaysAgo = new Date(now.setDate(now.getDate() - 5));

	return created <= fiveDaysAgo;
}


const _userTokenDecode = (
	mySQLPool: mysql.Pool,
	requireAdmin: boolean = false,
	requireVerification: boolean = true
) =>
{
	return async (req: express.Request, res: express.Response, next: express.NextFunction) =>
	{
		const authHeader = req.headers.authorization;

		const decoded = _verifyJWT(authHeader || null);

		if (!decoded)
		{
			res.status(HTTPStatus.UNAUTHORIZED).json({
				message: "Access denied: Invalid or missing token",
			});

			return;
		}

		if (requireAdmin && decoded.admin.data[0] !== 1)
		{
			res.status(HTTPStatus.FORBIDDEN).json({
				message: "Access denied: You are not an admin",
			});

			return;
		}

		let users: IUser[];

		[
			users,
		] = await mySQLPool.promise().query<IUser[]>("SELECT id, created, verified FROM user WHERE id = ?;", [
			decoded.id,
		]);

		if (users.length != 1)
		{
			res.status(HTTPStatus.UNAUTHORIZED).send("User not found from decoded token (or multiple users returned)");
			return;
		}

		if (users[0].verified[0] === 0 && requireVerification && _creationOverFiveDays(users[0].created))
		{
			res.status(HTTPStatus.UNAUTHORIZED).json({
				message: "Access denied: 5 days have passed since account creation. Please verify account.",
			});

			return;
		}

		// Attach decoded user to request object
		req.userDecoded = decoded;

		next();
	};
};


export default {
	userTokenDecode: (mySQLPool: mysql.Pool, requireVerification: boolean = true) =>
	{
		return _userTokenDecode(mySQLPool, false, requireVerification);
	},
	userTokenDecodeAdmin: (mySQLPool: mysql.Pool, requireVerification: boolean = true) =>
	{
		return _userTokenDecode(mySQLPool, true, requireVerification);
	},
	userTokenDecodeRequireVerificationStatus: (mySQLPool: mysql.Pool, expectedVerificationStatus: boolean) =>
	{
		return async (req: express.Request, res: express.Response, next: express.NextFunction) =>
		{
			try
			{
				const [
					users,
				]: [
					IUser[],
					FieldPacket[]
				] = await mySQLPool.promise().query<IUser[]>(
					"SELECT * FROM user WHERE id = ? AND verified = ?;",
					[
						req.userDecoded.id,
						expectedVerificationStatus ? "1" : "0",
					]
				);

				if (users.length == 0)
				{
					const message = expectedVerificationStatus ? "Expected user to be verified" : "Expected user to NOT be verified";

					res.status(HTTPStatus.BAD_REQUEST).json({
						message,
					});

					return;
				}
			}
			catch (error: Error | any)
			{
				if (error instanceof Error)
				{
					res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
						message: INTERNAL_SERVER_ERROR,
						error: error.message,
					});

					return;
				}

				res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
					message: INTERNAL_SERVER_ERROR,
					error: "Unknown Error",
				});
			}

			next();
		};
	},
};
