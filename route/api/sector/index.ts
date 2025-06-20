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
		* @returns {Sector[]}
		* @access User
		*/
		"/",
		async (req: express.Request, res: express.Response) =>
		{
			res.status(200).send(await dBHandlerSector.getSectors());
		}
	);
};
