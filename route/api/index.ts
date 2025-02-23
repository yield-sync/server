import express from "express";


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
			res.status(200).json({
				name: "yield_sync_server",
				timestamp: new Date().toISOString(),
			});

			return;
		}
	);
};

