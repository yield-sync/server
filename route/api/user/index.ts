// [import]
import cors from "cors";
import bcrypt from "bcryptjs";
import express from "express";
import mysql from "mysql";
import { promisify } from "util";

import config from "../../../config";
import { user } from "../../../middleware/token";
import sendEmailUserVerification from "../../../util/mailUtil";
import { validateEmail, validatePassword } from "../../../util/validationUtil";


const jsonWebToken = require("jsonwebtoken");

const ERROR_INVALID_PASSWORD: string = "Password Must be ASCII, longer than 8 characters, and contain a special character";


export default (dBConnection: mysql.Connection) =>
{
	// Promisify dbConnection.query for easier use with async/await
	const DB_QUERY = promisify(dBConnection.query).bind(dBConnection);

	const router: express.Router = express.Router().use(cors());

	router.post(
		"/create",
		async (req: express.Request, res: express.Response) =>
		{
			try
			{
				const load = req.body.load;

				// [VALIDATE] load.password
				if (!validateEmail(load.email))
				{
					res.status(400).send("Invalid email");

					return;
				}

				// Check that the email isnt already being used
				const RESULTS = await DB_QUERY("SELECT * FROM user WHERE email = ?;", [load.email]);

				if (RESULTS.length > 0)
				{
					res.status(400).send("This email is already being used.");

					return;
				}

				// [VALIDATE] load.password
				if (!validatePassword(load.password))
				{
					res.status(400).send(ERROR_INVALID_PASSWORD);

					return;
				}

				await DB_QUERY(
					"INSERT INTO user (email, password) VALUES (?, ?);",
					[load.email, await bcrypt.hash(load.password, 10)]
				);

				// Send Email
				await sendEmailUserVerification(load.email);

				res.status(201).send("Created user");

				return;
			}
			catch (error)
			{
				res.status(500).send(config.nodeENV == "production" ? "Internal server error" : error);

				return;
			}
		}
	);

	router.post(
		"/password-update",
		user(),
		async (req: express.Request, res: express.Response) =>
		{
			const load = req.body.load;
			try
			{
				const RESULT = await DB_QUERY(
					"SELECT * FROM user WHERE email = ?;",
					[req.body.userDecoded.email]
				);

				if (!bcrypt.compareSync(load.password, RESULT[0].password))
				{
					res.status(401).send("Invalid password.");

					return;
				}

				await DB_QUERY(
					"UPDATE user SET password = ? WHERE id = ?;",
					[await bcrypt.hash(load.passwordNew, 10), req.body.userDecoded.id]
				);

				res.status(200).send("Updated password.");

				return
			}
			catch (error)
			{
				res.status(500).send(config.nodeENV == "production" ? "Internal server error" : error);

				return;
			}
		}
	);

	router.post(
		"/login",
		async (req: express.Request, res: express.Response) =>
		{
			const load = req.body.load;

			try
			{
				const RESULT = await DB_QUERY("SELECT * FROM user WHERE email = ?;", [load.email]);

				if (RESULT.length == 0)
				{
					res.status(401).send("Invalid password or email");

					return;
				}

				if (!bcrypt.compareSync(load.password, RESULT[0].password))
				{
					res.status(401).send("Invalid password or email");

					return;
				}

				res.status(200).send({
					token: jsonWebToken.sign(
						{
							id: RESULT[0].id,
							email: RESULT[0].email,
							verified: RESULT[0].verified
						},
						config.app.secretKey,
						{
							expiresIn: config.nodeENV == "production" ? 7200 : 10000000
						}
					)
				});

				return;
			}
			catch (error)
			{
				res.status(500).send(config.nodeENV == "production" ? "Internal server error" : error);

				return;
			}
		}
	);

	return router;
};

