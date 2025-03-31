import bcrypt from "bcryptjs";
import express from "express";
import mysql from "mysql2";

import config from "../../../config";
import { INTERNAL_SERVER_ERROR, hTTPStatus } from "../../../constants";
import userToken from "../../../middleware/user-token";
import mailUtil from "../../../util/mailUtil";
import { validateEmail, validatePassword } from "../../../util/validation";
import sanitizer from "../../../util/sanitizer";


const jsonWebToken = require("jsonwebtoken");

const THREE_MINUTES_IN_MS: number = 5 * 60 * 1000;

const ERROR_INVALID_PASSWORD: string = "❌ Password Must be ASCII, longer than 8 characters, and contain a special character";


export default (mySQLPool: mysql.Pool): express.Router =>
{
	return express.Router().get(
		/**
		* @route get /api/user/
		* @desc User profile
		* @access User
		*/
		"/",
		userToken.userTokenDecode(mySQLPool),
		async (req: express.Request, res: express.Response) =>
		{
			try
			{
				const [
					users,
				]: [
					IUser[],
					FieldPacket[]
				] = await mySQLPool.promise().query<IUser[]>(
					"SELECT * FROM user WHERE email = ?;",
					[
						req.body.userDecoded.email,
					]
				);

				const normalizedUsers = users.map((user) =>
				{
					return {
						...user,
						// Convert Buffer to boolean
						admin: user.admin[0] === 1,
						verified: user.verified[0] === 1,
					};
				});

				res.status(hTTPStatus.OK).send({
					email: normalizedUsers[0].email,
					admin: normalizedUsers[0].admin,
					verified: normalizedUsers[0].verified,
				});
			}
			catch (error: Error | any)
			{
				if (error instanceof Error)
				{
					res.status(hTTPStatus.INTERNAL_SERVER_ERROR).json({
						message: INTERNAL_SERVER_ERROR,
						error: error.message
					});

					return
				}

				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).json({
					message: INTERNAL_SERVER_ERROR,
					error: "Unknown Error"
				});
			}
		}
	).get(
		/**
		* @route get /api/user/send-recovery-email
		* @access Public
		*/
		"/send-recovery-email/:email",
		async (req: express.Request, res: express.Response) =>
		{
			const timestamp = new Date();

			try
			{
				// Check if there is already a recovery in the database
				let recovery: IRecovery[];

				[
					recovery,
				] = await mySQLPool.promise().query<IRecovery[]>(
					"SELECT * FROM recovery WHERE user_id = ?;",
					[
						req.body.userDecoded.id,
					]
				);

				if (recovery.length > 0)
				{
					const created = new Date(recovery[0].created);

					// If not enough time since last request has passed..
					if (timestamp.getTime() - created.getTime() < THREE_MINUTES_IN_MS)
					{
						res.status(hTTPStatus.BAD_REQUEST).json({
							message: "⏳ 3 minutes must pass before last request for recovery email"
						});

						return;
					}
				}

				const verificationPin = Math.random().toString(36).slice(2, 8).padEnd(6, '0');

				// Create an instance of recovery in the DB
				await mySQLPool.promise().query(
					"INSERT INTO recovery (user_id, pin) VALUES (?, ?);",
					[
						req.body.userDecoded.id,
						verificationPin,
					]
				);

				await mailUtil.sendRecoveryEmail(req.params.email, verificationPin);

				res.status(hTTPStatus.OK).json({
					message: "Email sent"
				});
			}
			catch (error: Error | any)
			{
				if (error instanceof Error)
				{
					res.status(hTTPStatus.INTERNAL_SERVER_ERROR).json({
						message: INTERNAL_SERVER_ERROR,
						error: error.message
					});

					return
				}

				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).json({
					message: INTERNAL_SERVER_ERROR,
					error: "Unknown Error"
				});
			}
		}
	).get(
		/**
		* @route GET /api/user/send-verification-email
		* @access User
		*/
		"/send-verification-email",
		userToken.userTokenDecode(mySQLPool, false),
		userToken.userTokenDecodeRequireVerificationStatus(mySQLPool, false),
		async (req: express.Request, res: express.Response) =>
		{
			const timestamp = new Date();

			// Check if there is already a verification in the database
			let verification: IVerification[];

			try
			{
				[
					verification,
				] = await mySQLPool.promise().query<IVerification[]>(
					"SELECT * FROM verification WHERE user_id = ?;",
					[
						req.body.userDecoded.id,
					]
				);

				if (verification.length > 0)
				{
					const created = new Date(verification[0].created);

					// If not enough time since last request has passed..
					if (timestamp.getTime() - created.getTime() < THREE_MINUTES_IN_MS)
					{
						res.status(hTTPStatus.BAD_REQUEST).json({
							message: "⏳ 3 minutes must pass before last request for verification email"
						});

						return;
					}
				}

				// If verification already exists -> delete it
				await mySQLPool.promise().query<IUser[]>(
					"DELETE FROM verification WHERE user_id = ?;",
					[
						req.body.userDecoded.id,
					]
				);

				const verificationPin = Math.random().toString(36).slice(2, 8).padEnd(6, '0');

				// Create an instance of verifcation in the DB
				await mySQLPool.promise().query(
					"INSERT INTO verification (user_id, pin) VALUES (?, ?);",
					[
						req.body.userDecoded.id,
						verificationPin,
					]
				);

				await mailUtil.sendVerificationEmail(req.body.userDecoded.email, verificationPin);

				res.status(hTTPStatus.OK).send({ message: "Created verification" });
			}
			catch (error: Error | any)
			{
				if (error instanceof Error)
				{
					res.status(hTTPStatus.INTERNAL_SERVER_ERROR).json({
						message: INTERNAL_SERVER_ERROR,
						error: error.message
					});
				}
				else
				{
					res.status(hTTPStatus.INTERNAL_SERVER_ERROR).json({
						message: INTERNAL_SERVER_ERROR,
						error: "Unknown Error"
					});
				}

				return;
			}
		}
	).post(
		/**
		* @route POST /api/user/create
		* @desc Creates a user
		* @access Public
		*/
		"/create",
		async (req: express.Request, res: express.Response) =>
		{
			const { email, password, }: UserCreate = req.body.load;

			try
			{
				if (!validateEmail(email))
				{
					res.status(hTTPStatus.BAD_REQUEST).send("❌ Invalid email");

					return;
				}

				if (!validatePassword(password))
				{
					res.status(hTTPStatus.BAD_REQUEST).send(ERROR_INVALID_PASSWORD);

					return;
				}

				// Check email available
				let users: IUser[];

				[
					users,
				] = await mySQLPool.promise().query<IUser[]>(
					"SELECT * FROM user WHERE email = ?;",
					[
						email,
					]
				);

				if (users.length > 0)
				{
					res.status(hTTPStatus.BAD_REQUEST).json({ message: "❌ This email is already being used." });

					return;
				}

				await mySQLPool.promise().query(
					"INSERT INTO user (email, password) VALUES (?, ?);",
					[
						email,
						await bcrypt.hash(password, 10),
					]
				);

				res.status(hTTPStatus.CREATED).json({ message: "✅ Created user!" });

				return;
			}
			catch (error: Error | any)
			{
				if (error instanceof Error)
				{
					res.status(hTTPStatus.INTERNAL_SERVER_ERROR).json({
						message: INTERNAL_SERVER_ERROR,
						error: error.message
					});

					return
				}

				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).json({
					message: INTERNAL_SERVER_ERROR,
					error: "Unknown Error"
				});
			}
		}
	).post(
		/**
		* @route POST /api/user/password-udpate
		* @desc Update password
		* @access User
		*/
		"/password-update",
		userToken.userTokenDecode(mySQLPool),
		async (req: express.Request, res: express.Response) =>
		{
			const { password, passwordNew, }: UserPasswordUpdate = req.body.load;

			try
			{
				const [
					users,
				]: [
					IUser[],
					FieldPacket[]
				] = await mySQLPool.promise().query<IUser[]>(
					"SELECT * FROM user WHERE email = ?;",
					[
						req.body.userDecoded.email,
					]
				);

				if (!bcrypt.compareSync(password, users[0].password))
				{
					res.status(401).send("❌ Invalid password.");

					return;
				}

				await mySQLPool.promise().query(
					"UPDATE user SET password = ? WHERE id = ?;",
					[
						await bcrypt.hash(passwordNew, 10),
						req.body.userDecoded.id,
					]
				);

				res.status(hTTPStatus.OK).send("Updated password.");
			}
			catch (error: Error | any)
			{
				if (error instanceof Error)
				{
					res.status(hTTPStatus.INTERNAL_SERVER_ERROR).json({
						message: INTERNAL_SERVER_ERROR,
						error: error.message
					});

					return
				}

				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).json({
					message: INTERNAL_SERVER_ERROR,
					error: "Unknown Error"
				});
			}
		}
	).post(
		/**
		* @route POST /api/user/login
		* @desc Login
		* @access Public
		*/
		"/login",
		async (req: express.Request, res: express.Response) =>
		{
			const { email, password, }: UserLogin = req.body.load;

			try
			{
				const [
					users,
				]: [
					IUser[],
					FieldPacket[]
				] = await mySQLPool.promise().query<IUser[]>(
					"SELECT * FROM user WHERE email = ?;",
					[
						email,
					]
				);

				if (users.length != 1)
				{
					res.status(401).send("❌ Invalid password or email");

					return;
				}

				if (!bcrypt.compareSync(password, users[0].password))
				{
					res.status(401).send("❌ Invalid password or email");

					return;
				}

				res.status(hTTPStatus.OK).send({
					token: jsonWebToken.sign(
						{
							id: users[0].id,
							email: users[0].email,
							admin: users[0].admin,
							verified: users[0].verified,
						},
						config.app.secretKey,
						{
							expiresIn: config.nodeENV == "production" ? 7200 : 10000000,
						}
					),
				});
			}
			catch (error: Error | any)
			{
				if (error instanceof Error)
				{
					res.status(hTTPStatus.INTERNAL_SERVER_ERROR).json({
						message: INTERNAL_SERVER_ERROR,
						error: error.message
					});

					return
				}

				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).json({
					message: INTERNAL_SERVER_ERROR,
					error: "Unknown Error"
				});
			}
		}
	).post(
		/**
		* @route POST /api/user/verify
		* @access Public
		*/
		"/verify",
		userToken.userTokenDecode(mySQLPool, false),
		userToken.userTokenDecodeRequireVerificationStatus(mySQLPool, false),
		async (req: express.Request, res: express.Response) =>
		{
			const { pin }: UserVerify = req.body.load;

			try
			{
				const sanitizedPin = sanitizer.sanitizePin(pin);

				let verification: IVerification[];

				[
					verification,
				] = await mySQLPool.promise().query<IVerification[]>(
					"SELECT * FROM verification WHERE user_id = ? AND pin = ?;",
					[
						req.body.userDecoded.id,
						sanitizedPin,
					]
				);

				if (verification.length == 0)
				{
					res.status(hTTPStatus.BAD_REQUEST).json({
						message: "❌ Invalid pin",
					});

					return;
				}

				await mySQLPool.promise().query(
					"UPDATE user SET verified = 1 WHERE id = ?;",
					[
						req.body.userDecoded.id,
					]
				);

				res.status(hTTPStatus.OK).json({
					message: "✅ User verified",
				});
			}
			catch (error: Error | any)
			{
				if (error instanceof Error)
				{
					res.status(hTTPStatus.INTERNAL_SERVER_ERROR).json({
						message: INTERNAL_SERVER_ERROR,
						error: error.message
					});

					return
				}

				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).json({
					message: INTERNAL_SERVER_ERROR,
					error: "Unknown Error"
				});
			}
		}
	).post(
		/**
		* @route POST /api/user/verify
		* @access Public
		*/
		"/recover-password",
		userToken.userTokenDecode(mySQLPool, false),
		userToken.userTokenDecodeRequireVerificationStatus(mySQLPool, false),
		async (req: express.Request, res: express.Response) =>
		{
			const { pin, passwordNew }: UserRecoverPassword = req.body.load;

			try
			{
				const sanitizedPin = sanitizer.sanitizePin(pin);

				if (!validatePassword(passwordNew))
				{
					res.status(hTTPStatus.BAD_REQUEST).send(ERROR_INVALID_PASSWORD);

					return;
				}

				let recovery: IRecovery[];

				[
					recovery,
				] = await mySQLPool.promise().query<IRecovery[]>(
					"SELECT * FROM recovery WHERE user_id = ? AND pin = ?;",
					[
						req.body.userDecoded.id,
						sanitizedPin,
					]
				);

				if (recovery.length == 0)
				{
					res.status(hTTPStatus.BAD_REQUEST).json({
						message: "❌ Invalid pin",
					});

					return;
				}

				await mySQLPool.promise().query(
					"UPDATE user SET password = ? WHERE id = ?;",
					[
						req.body.userDecoded.id,
						await bcrypt.hash(passwordNew, 10),
					]
				);

				res.status(hTTPStatus.OK).json({
					message: "✅ User password updated",
				});
			}
			catch (error: Error | any)
			{
				if (error instanceof Error)
				{
					res.status(hTTPStatus.INTERNAL_SERVER_ERROR).json({
						message: INTERNAL_SERVER_ERROR,
						error: error.message
					});

					return
				}

				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).json({
					message: INTERNAL_SERVER_ERROR,
					error: "Unknown Error"
				});
			}
		}
	);;
};

