import express from "express";
import mysql from "mysql2";

import config from "../config";
import { hTTPStatus } from "../constants";


const jwt = require("jsonwebtoken");


const { secretKey, } = config.app;


function verifyJWT(token: string): any | null
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

function creationOverFiveDays(created: Date): boolean
{
	const now = new Date();

	const fiveDaysAgo = new Date(now.setDate(now.getDate() - 5));

	return created <= fiveDaysAgo;
}


export const userMiddleware = (
	mySQLPool: mysql.Pool,
	requireAdmin: boolean = false,
	requireVerification: boolean = true
) =>
{
	return async (req: express.Request, res: express.Response, next: express.NextFunction) =>
	{
		const authHeader = req.headers.authorization;

		const decoded = verifyJWT(authHeader || null);

		if (!decoded)
		{
			res.status(hTTPStatus.UNAUTHORIZED).json({
				message: "Access denied: Invalid or missing token",
			});

			return;
		}

		if (requireAdmin && decoded.admin.data[0] !== 1)
		{
			res.status(hTTPStatus.FORBIDDEN).json({
				message: "Access denied: You are not an admin",
			});

			return;
		}

		let users: IUser[];

		[
			users,
		] = await mySQLPool.promise().query<IUser[]>("SELECT id, created FROM user WHERE id = ?;", [
			decoded.id,
		]);

		if (users.length != 1)
		{
			res.status(hTTPStatus.UNAUTHORIZED).send("User not found from decoded token (or multiple users returned)");
			return;
		}

		if (requireVerification != false && creationOverFiveDays(users[0].created))
		{
			res.status(hTTPStatus.UNAUTHORIZED).json({
				message: "Access denied: 5 days have passed since account creation. Please verify account.",
			});

			return;
		}

		// Attach decoded user to request object
		req.body.userDecoded = decoded;

		next();
	};
};

export const user = (mySQLPool: mysql.Pool) =>
{
	return userMiddleware(mySQLPool, false);
};

export const userAdmin = (mySQLPool: mysql.Pool) =>
{
	return userMiddleware(mySQLPool, true);
};
