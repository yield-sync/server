import express from "express";


export default () =>
{
	/**
	* @route GET /api
	* @desc Get status of Server
	* @access Public
	*/
	return express.Router().get(
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

