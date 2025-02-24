import express from "express";

import { hTTPStatus } from "../../constants";


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
			res.status(hTTPStatus.OK).json({
				name: "yield_sync_server",
				timestamp: new Date().toISOString(),
			});

			return;
		}
	);
};
