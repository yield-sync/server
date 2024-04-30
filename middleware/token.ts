// [import]
import express from "express";

import config from '../config';


// [require]
const jwt = require("jsonwebtoken");


// [INIT] Const
const { secretKey } = config.app;


function verifyJWT(tokenBody: string | string[])
{
	let returnDecoded;

	// [VERIFY] tokenBody
	jwt.verify(
		tokenBody,
		secretKey,
		async (err, decoded) =>
		{
			if (decoded)
			{
				returnDecoded = decoded;
			}
		}
	);

	return returnDecoded;
}


export const user = () =>
{
	return (req: express.Request, res: express.Response, next: express.NextFunction) =>
	{
		if (!req.headers.tokenuser)
		{
			res.status(401).send("Access denied: No token passed");

			return;
		}

		// Remove "Bearer "
		const tokenBody = req.headers.tokenuser.slice(7);

		const DECODED = verifyJWT(tokenBody);

		if (!DECODED)
		{
			res.status(401).send("Access denied: Invalid token");

			return;
		}

		// [INIT] Put decoded in req.body
		req.body = {
			...req.body,
			userDecoded: DECODED,
		};

		// [200] Success
		next();
	};
}

export const userAdmin = () =>
{
	return (req: express.Request, res: express.Response, next: express.NextFunction) =>
	{
		if (!req.headers.tokenuser)
		{
			res.status(401).send("Access denied: No token passed");

			return;
		}

		// Remove "Bearer "
		const tokenBody = req.headers.tokenuser.slice(7);

		const DECODED = verifyJWT(tokenBody);

		if (!DECODED)
		{
			res.status(401).send("Access denied: Invalid token");

			return;
		}

		if (!DECODED.admin)
		{
			res.status(401).send("Access denied: not admin");

			return;
		}

		// [INIT] Put decoded in req.body
		req.body = {
			...req.body,
			userDecoded: DECODED,
		};

		// [200] Success
		next();
	}
}

