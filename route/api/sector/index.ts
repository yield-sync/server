import express from "express";
import mysql from "mysql2";

import { loadRequired } from "../../../middleware/load";
import DBHandlerSector from "../../../db-handler/DBHandlerSector";


export default (mySQLPool: mysql.Pool): express.Router =>
{
	let dBHandlerSector: DBHandlerSector = new DBHandlerSector(mySQLPool);


	/**
	* @route /api/sector/
	* @desc Sector API routes
	* @returns {express.Router}
	*/
	return express.Router().get(
		/**
		* @route GET /api/sector/
		* @desc Get all sectors
		* @returns {ISector[]}
		* @access User
		*/
		"/",
		async (req: express.Request, res: express.Response) =>
		{
			const sectors: ISector[] = await dBHandlerSector.getSectors();

			const sectorsOnly = sectors.map((s) => 
			{
				return (s.sector);
			});

			res.status(200).send(sectorsOnly);
		}
	);
};
