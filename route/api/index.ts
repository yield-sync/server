import { Router, Request, Response } from "express";


export default (): Router =>
{
	return Router().get(
		/**
		* @route GET /api
		* @desc Get status of Server
		* @access Public
		*/
		"/",
		async (req: Request, res: Response) =>
		{
			res.status(200).json({
				name: "yield_sync_server",
				timestamp: new Date().toISOString(),
			});

			return;
		}
	);
};

