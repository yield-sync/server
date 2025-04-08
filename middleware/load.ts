import express from "express";

import { HTTPStatus } from "../constants";


export const loadRequired = () =>
{
	return async (req: express.Request, res: express.Response, next: express.NextFunction) =>
	{
		if (!req.body.load)
		{
			res.status(HTTPStatus.BAD_REQUEST).send("No load passed");
			return;
		}

		next();
	};
};
