import express from "express";

import config from '../config';


const jwt = require("jsonwebtoken");


const { secretKey } = config.app;


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


export const userMiddleware = (requireAdmin: boolean = false) =>
{
	return (req: express.Request, res: express.Response, next: express.NextFunction) =>
	{
		const authHeader = req.headers.authorization;

		const decoded = verifyJWT(authHeader || "");

		if (!decoded)
		{
			res.status(401).json({ message: "Access denied: Invalid or missing token" });

			return;
		}

		if (requireAdmin && !decoded.admin)
		{
			res.status(403).json({ message: "Access denied: You are not an admin" });

			return;
		}

		// Attach decoded user to request object
		req.body.userDecoded = decoded;

		next();
	};
};

export const user = () => userMiddleware(false);

export const userAdmin = () => userMiddleware(true);
