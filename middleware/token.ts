// [REQUIRE]
const jwt = require('jsonwebtoken');


// [import]
import express from "express";

import config from '../config';


// [INIT] Const
const { secretKey } = config.app;


// [INIT]
let returnObj = {
	executed: true as boolean,
	status: false as boolean,
	message: "" as string,
	location: "/middleware/Auth" as string,
	auth: false as boolean
};


export const user = () =>
{
	return (req: express.Request, res: express.Response, next: any) =>
	{
		if (!req.headers.tokenuser)
		{
			res.status(401).send({
				...returnObj,
				message: 'Access denied: No token passed',
			});

			return;
		}

		// Remove "Bearer "
		const tokenBody = req.headers.tokenuser.slice(7);

		// [VERIFY] tokenBody
		jwt.verify(
			tokenBody,
			secretKey,
			async (err, decoded) =>
			{
				if (err)
				{
					res.status(401).send({
						...returnObj,
						message: `Access denied: JWT Error --> ${err}`,
					});

					return;
				}

				if (decoded)
				{
					// [INIT] Put decoded in req.body
					req.body = {
						...req.body,
						userDecoded: decoded,
					};

					// [200] Success
					next();

					return;
				}
			}
		);
	};
}
