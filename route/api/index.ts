// [import]
import cors from "cors";
import express from "express";


export default () =>
{
	const router: express.Router = express.Router().use(cors());


	router.get(
		"/",
		async (req: express.Request, res: express.Response) =>
		{
			res.status(200).send({
				name: "yield_sync"
			});

			return;
		}
	);


	return router;
};

