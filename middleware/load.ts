import express from "express";

import { hTTPStatus } from "../constants";


export const loadRequired = () =>
{
	return async (req: express.Request, res: express.Response, next: express.NextFunction) =>
	{
		if (!req.body.load)
		{
			res.status(hTTPStatus.BAD_REQUEST).send("No load passed");
			return;
		}

		next();
	};
};
