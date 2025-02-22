import bcrypt from "bcryptjs";
import { Router, Request, Response } from "express";
import mysql, { FieldPacket } from "mysql2";

import config from "../../../config";
import { user } from "../../../middleware/token";
import { setVerificationEmail } from "../../../util/mailUtil";
import { validateEmail, validatePassword } from "../../../util/validationUtil";


const jsonWebToken = require("jsonwebtoken");

const ERROR_INVALID_PASSWORD: string = "Password Must be ASCII, longer than 8 characters, and contain a special character";


export default (mySQLPool: mysql.Pool): Router =>
{
	return Router().get(
		/**
		* @route POST /api/user/
		* @desc User profile
		* @access User
		*/
		"/",
		user(),
		async (req: Request, res: Response) =>
		{
			const [users]: [IUser[], FieldPacket[]] = await mySQLPool.promise().query<IUser[]>(
				"SELECT * FROM user WHERE email = ?;",
				[req.body.userDecoded.email]
			);

			const normalizedUsers = users.map(user => ({
				...user,
				// Convert Buffer to boolean
				admin: user.admin[0] === 1,
				verified: user.verified[0] === 1,
			}));

			res.status(200).send({
				email: normalizedUsers[0].email,
				admin: normalizedUsers[0].admin,
				verified: normalizedUsers[0].verified,
			});
		}
	).post(
		/**
		* @route POST /api/user/create
		* @desc Creates a user
		* @access Public
		*/
		"/create",
		async (req: Request, res: Response) =>
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
				const [users]: [IUser[], FieldPacket[]] = await mySQLPool.promise().query<IUser[]>(
					"SELECT * FROM user WHERE email = ?;",
					[load.email]
				);

				if (users.length > 0)
				{
					res.status(400).send("This email is already being used.");

					return;
				}

				if (!validatePassword(load.password))
				{
					res.status(400).send(ERROR_INVALID_PASSWORD);

					return;
				}

				await mySQLPool.promise().query(
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
	).post(
		/**
		* @route POST /api/user/password-udpate
		* @desc Update password
		* @access User
		*/
		"/password-update",
		user(),
		async (req: Request, res: Response) =>
		{
			const load: UserPasswordUpdate = req.body.load;

			try
			{
				const [users]: [IUser[], FieldPacket[]] = await mySQLPool.promise().query<IUser[]>(
					"SELECT * FROM user WHERE email = ?;",
					[req.body.userDecoded.email]
				);

				if (!bcrypt.compareSync(load.password, users[0].password))
				{
					res.status(401).send("Invalid password.");

					return;
				}

				await mySQLPool.promise().query(
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
	).post(
		/**
		* @route POST /api/user/login
		* @desc Login
		* @access Public
		*/
		"/login",
		async (req: Request, res: Response) =>
		{
			const load: UserLogin = req.body.load;

			try
			{
				const [users]: [IUser[], FieldPacket[]] = await mySQLPool.promise().query<IUser[]>(
					"SELECT * FROM user WHERE email = ?;",
					[load.email]
				);

				if (users.length != 1)
				{
					res.status(401).send("Invalid password or email");

					return;
				}

				const user: IUser = users[0];

				if (!bcrypt.compareSync(load.password, user.password))
				{
					res.status(401).send("Invalid password or email");

					return;
				}

				res.status(200).send({
					token: jsonWebToken.sign(
						{
							id: user.id,
							email: user.email,
							admin: user.admin,
							verified: user.verified
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
	).post(
		"/verify",
		async (req: Request, res: Response) =>
		{
			const load: UserVerify = req.body.load;

			res.status(200).json({
				message: "Verified"
			})
		}
	);
};

