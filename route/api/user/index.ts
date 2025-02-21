// [import]
import cors from "cors";
import bcrypt from "bcryptjs";
import express from "express";
import mysql, { RowDataPacket, FieldPacket } from "mysql2";

import { UserCreate, UserLogin, UserPasswordUpdate } from "./types";
import config from "../../../config";
import { user } from "../../../middleware/token";
import { setVerificationEmail } from "../../../util/mailUtil";
import { validateEmail, validatePassword } from "../../../util/validationUtil";


const jsonWebToken = require("jsonwebtoken");

const ERROR_INVALID_PASSWORD: string = "Password Must be ASCII, longer than 8 characters, and contain a special character";


export default (dBConnection: mysql.Pool) =>
{
	const router: express.Router = express.Router().use(cors());

	router.post(
		"/create",
		async (req: express.Request, res: express.Response) =>
		{
			try
			{
				const load: UserCreate = req.body.load;

				if (!validateEmail(load.email))
				{
					res.status(400).send("Invalid email");

					return;
				}

				// Check email available
				const [rows,]: [RowDataPacket[], FieldPacket[]] = await dBConnection.promise().query(
					"SELECT * FROM user WHERE email = ?;",
					[load.email]
				);

				if (rows.length > 0)
				{
					res.status(400).send("This email is already being used.");

					return;
				}

				if (!validatePassword(load.password))
				{
					res.status(400).send(ERROR_INVALID_PASSWORD);

					return;
				}

				await dBConnection.promise().query(
					"INSERT INTO user (email, password) VALUES (?, ?);",
					[load.email, await bcrypt.hash(load.password, 10)]
				);

				// Send Email
				await setVerificationEmail(load.email);

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
			const load: UserPasswordUpdate = req.body.load;

			try
			{
				const [rows]: [mysql.QueryResult, mysql.FieldPacket[]] = await dBConnection.promise().query(
					"SELECT * FROM user WHERE email = ?;",
					[req.body.userDecoded.email]
				);

				if (!bcrypt.compareSync(load.password, rows[0].password))
				{
					res.status(401).send("Invalid password.");

					return;
				}

				await dBConnection.promise().query(
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
			const load: UserLogin = req.body.load;

			try
			{
				const [rows] = await dBConnection.promise().query("SELECT * FROM user WHERE email = ?;", [load.email]);

				if (rows[0].length == 0)
				{
					res.status(401).send("Invalid password or email");

					return;
				}

				if (!bcrypt.compareSync(load.password, rows[0].password))
				{
					res.status(401).send("Invalid password or email");

					return;
				}

				res.status(200).send({
					token: jsonWebToken.sign(
						{
							id: rows[0].id,
							email: rows[0].email,
							admin: rows[0].admin,
							verified: rows[0].verified
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

