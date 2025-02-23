import express from "express";

import { HTTPStatus } from "../../constants/HTTPStatus";


export default (): express.Router =>
{
	return express.Router().get(
		/**
		* @route GET /api
		* @desc Get status of Server
		* @access Public
		*/
		"/",
		async (req: express.Request, res: express.Response) =>
		{
			res.status(HTTPStatus.OK).json({
				name: "yield_sync_server",
				timestamp: new Date().toISOString(),
			});

			return;
		}
	);
};
