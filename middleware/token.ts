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


export const userMiddleware = (mySQLPool: mysql.Pool, requireAdmin: boolean = false) =>
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

		let users;

		[
			users,
		] = await mySQLPool.promise().query<IStock[]>("SELECT id FROM user WHERE id = ?;", [
			decoded.id,
		]);

		if ((users as any[]).length === 0)
		{
			res.status(hTTPStatus.UNAUTHORIZED).send("User not found from decoded token");
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
