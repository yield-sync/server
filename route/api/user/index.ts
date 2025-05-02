import bcrypt from "bcryptjs";
import express from "express";
import mysql from "mysql2";

import config from "../../../config";
import rateLimiter from "../../../rate-limiter";
import { INTERNAL_SERVER_ERROR, HTTPStatus } from "../../../constants";
import userToken from "../../../middleware/user-token";
import mailUtil from "../../../util/mailUtil";
import { validateEmail, validatePassword } from "../../../util/validation";
import sanitizer from "../../../util/sanitizer";


const jsonWebToken = require("jsonwebtoken");

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
						req.userDecoded.email,
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

				res.status(HTTPStatus.OK).send({
					email: normalizedUsers[0].email,
					admin: normalizedUsers[0].admin,
					verified: normalizedUsers[0].verified,
				});
			}
			catch (error: Error | any)
			{
				if (error instanceof Error)
				{
					res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
						message: `${INTERNAL_SERVER_ERROR}: ${error.message}`,
					});

					return;
				}

				res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
					message: `${INTERNAL_SERVER_ERROR}: Unknown error`,
				});
			}
		}
	).get(
		/**
		* @route get /api/user/password-recovery/send-email
		* @access Public
		*/
		"/password-recovery/send-email/:email",
		rateLimiter.emailRateLimiter,
		async (req: express.Request, res: express.Response) =>
		{
			const timestamp = new Date();

			try
			{
				let email: string;
				try
				{
					email = sanitizer.sanitizeEmail(req.params.email);
				}
				catch (error)
				{
					if (error instanceof Error)
					{
						res.status(HTTPStatus.BAD_REQUEST).json({
							message: "❌ Invalid email format",
						});

						return;
					}

					throw new Error(error);
				}

				const [
					users,
				]: [
					IUser[],
					FieldPacket[]
				] = await mySQLPool.promise().query<IUser[]>(
					"SELECT id FROM user WHERE email = ?;",
					[
						email,
					]
				);

				if (users.length == 0)
				{
					res.status(HTTPStatus.BAD_REQUEST).json({
						message: "❌ Email not found",
					});

					return;
				}

				// Check if there is already a recovery in the database
				let recovery: IRecovery[];

				[
					recovery,
				] = await mySQLPool.promise().query<IRecovery[]>(
					"SELECT * FROM recovery WHERE user_id = ?;",
					[
						users[0].id,
					]
				);

				// If verification already exists -> delete it
				await mySQLPool.promise().query<IUser[]>(
					"DELETE FROM recovery WHERE user_id = ?;",
					[
						users[0].id,
					]
				);

				const verificationPin = Math.random().toString(36).slice(2, 8).padEnd(6, "0");

				// Create an instance of recovery in the DB
				await mySQLPool.promise().query(
					"INSERT INTO recovery (user_id, pin) VALUES (?, ?);",
					[
						users[0].id,
						verificationPin,
					]
				);

				await mailUtil.sendRecoveryEmail(req.params.email, verificationPin);

				res.status(HTTPStatus.OK).json({
					message: "✅ Password recovery email sent",
				});
			}
			catch (error: Error | any)
			{
				if (error instanceof Error)
				{
					res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
						message: `${INTERNAL_SERVER_ERROR}: ${error.message}`,
					});

					return;
				}

				res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
					message: `${INTERNAL_SERVER_ERROR}: Unknown error`,
				});
			}
		}
	).get(
		/**
		* @route GET /api/user/verification/send-verification
		* @access User
		*/
		"/verification/send-verification",
		userToken.userTokenDecode(mySQLPool, false),
		userToken.userTokenDecodeRequireVerificationStatus(mySQLPool, false),
		rateLimiter.emailRateLimiter,
		async (req: express.Request, res: express.Response) =>
		{
			try
			{
				// If verification already exists -> delete it
				await mySQLPool.promise().query<IUser[]>(
					"DELETE FROM verification WHERE user_id = ?;",
					[
						req.userDecoded.id,
					]
				);

				const verificationPin = Math.random().toString(36).slice(2, 8).padEnd(6, "0");

				// Create an instance of verifcation in the DB
				await mySQLPool.promise().query(
					"INSERT INTO verification (user_id, pin) VALUES (?, ?);",
					[
						req.userDecoded.id,
						verificationPin,
					]
				);

				await mailUtil.sendVerificationEmail(req.userDecoded.email, verificationPin);

				res.status(HTTPStatus.OK).send({
					message: "✅ Created verification",
				});
			}
			catch (error: Error | any)
			{
				if (error instanceof Error)
				{
					res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
						message: INTERNAL_SERVER_ERROR,
						error: error.message,
					});
				}
				else
				{
					res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
						message: INTERNAL_SERVER_ERROR,
						error: "Unknown Error",
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
					res.status(HTTPStatus.BAD_REQUEST).send("❌ Invalid email");

					return;
				}

				if (!validatePassword(password))
				{
					res.status(HTTPStatus.BAD_REQUEST).send(ERROR_INVALID_PASSWORD);

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
					res.status(HTTPStatus.BAD_REQUEST).json({
						message: "❌ This email is already being used.",
					});

					return;
				}

				await mySQLPool.promise().query(
					"INSERT INTO user (email, password) VALUES (?, ?);",
					[
						email,
						await bcrypt.hash(password, 10),
					]
				);

				res.status(HTTPStatus.CREATED).json({
					message: "✅ Created user!",
				});

				return;
			}
			catch (error: Error | any)
			{
				if (error instanceof Error)
				{
					res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
						message: `${INTERNAL_SERVER_ERROR}: ${error.message}`,
					});

					return;
				}

				res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
					message: `${INTERNAL_SERVER_ERROR}: Unknown error`,
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

				res.status(HTTPStatus.OK).send({
					token: jsonWebToken.sign(
						{
							id: users[0].id,
							email: users[0].email,
							admin: users[0].admin,
							verified: users[0].verified,
						},
						config.app.secretKey,
						{
							expiresIn: config.nodeENV == "production" ? "7d" : "100d",
						}
					),
				});
			}
			catch (error: Error | any)
			{
				if (error instanceof Error)
				{
					res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
						message: `${INTERNAL_SERVER_ERROR}: ${error.message}`,
					});

					return;
				}

				res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
					message: `${INTERNAL_SERVER_ERROR}: Unknown error`,
				});
			}
		}
	).post(
		/**
		* @route POST /api/user/verification/verify
		* @access Public
		*/
		"/verification/verify",
		userToken.userTokenDecode(mySQLPool, false),
		userToken.userTokenDecodeRequireVerificationStatus(mySQLPool, false),
		async (req: express.Request, res: express.Response) =>
		{
			const { pin, }: UserVerify = req.body.load;

			try
			{
				const [
					verification,
				] = await mySQLPool.promise().query<IVerification[]>(
					"SELECT * FROM verification WHERE user_id = ?;",
					[
						req.userDecoded.id,
					]
				);

				if (verification.length == 0)
				{
					res.status(HTTPStatus.BAD_REQUEST).json({
						message: "❌ No verification found",
					});

					return;
				}

				const [
					verificationWithPin,
				] = await mySQLPool.promise().query<IVerification[]>(
					"SELECT * FROM verification WHERE user_id = ? AND pin = ?;",
					[
						req.userDecoded.id,
						sanitizer.sanitizePin(pin),
					]
				);

				if (verificationWithPin.length === 0)
				{
					// If on 3rd attempt..
					if (verification[0].attempts === 2)
					{
						await mySQLPool.promise().query<IUser[]>(
							"DELETE FROM verification WHERE user_id = ?;",
							[
								req.userDecoded.id,
							]
						);

						res.status(HTTPStatus.BAD_REQUEST).json({
							message: "❌ Invalid pin and attempts exceeded",
						});

						return;
					}

					const attempts = verification[0].attempts + 1;

					// Increment the attempt
					await mySQLPool.promise().query(
						"UPDATE verification SET attempts = ? WHERE id = ?;",
						[
							attempts,
							verification[0].id,
						]
					);

					res.status(HTTPStatus.BAD_REQUEST).json({
						message: "❌ Invalid pin",
					});

					return;
				}

				await mySQLPool.promise().query(
					"UPDATE user SET verified = 1 WHERE id = ?;",
					[
						req.userDecoded.id,
					]
				);

				res.status(HTTPStatus.OK).json({
					message: "✅ Email verified",
				});
			}
			catch (error: Error | any)
			{
				if (error instanceof Error)
				{
					res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
						message: `${INTERNAL_SERVER_ERROR}: ${error.message}`,
					});

					return;
				}

				res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
					message: `${INTERNAL_SERVER_ERROR}: Unknown error`,
				});
			}
		}
	).post(
		/**
		* @route POST /api/user/
		* @access Public
		*/
		"/password-recovery/recover/:email",
		async (req: express.Request, res: express.Response) =>
		{
			const { pin, passwordNew, }: UserRecoverPassword = req.body.load;

			try
			{
				const email: string = sanitizer.sanitizeEmail(req.params.email);

				const [
					users,
				]: [
					IUser[],
					FieldPacket[]
				] = await mySQLPool.promise().query<IUser[]>(
					"SELECT id FROM user WHERE email = ?;",
					[
						email,
					]
				);

				if (users.length == 0)
				{
					res.status(HTTPStatus.BAD_REQUEST).json({
						message: "❌ Invalid email",
					});

					return;
				}

				if (!validatePassword(passwordNew))
				{
					res.status(HTTPStatus.BAD_REQUEST).json({
						message: ERROR_INVALID_PASSWORD,
					});

					return;
				}

				let recovery: IRecovery[];

				[
					recovery,
				] = await mySQLPool.promise().query<IRecovery[]>(
					"SELECT * FROM recovery WHERE user_id = ?;",
					[
						users[0].id,
					]
				);

				if (recovery.length == 0)
				{
					res.status(HTTPStatus.BAD_REQUEST).json({
						message: "❌ No recovery found",
					});

					return;
				}

				const sanitizedPin = sanitizer.sanitizePin(pin);

				const [
					recoveryWithPin,
				] = await mySQLPool.promise().query<IRecovery[]>(
					"SELECT * FROM recovery WHERE user_id = ? AND pin = ?;",
					[
						users[0].id,
						sanitizedPin,
					]
				);

				if (recoveryWithPin.length === 0)
				{
					// If on 3rd attempt..
					if (recovery[0].attempts === 2)
					{
						await mySQLPool.promise().query<IUser[]>(
							"DELETE FROM recovery WHERE user_id = ?;",
							[
								users[0].id,
							]
						);

						res.status(HTTPStatus.TOO_MANY_REQUEST).json({
							message: "❌ Invalid pin and attempts exceeded",
						});

						return;
					}

					const attempts = recovery[0].attempts + 1;

					// Increment the attempt
					await mySQLPool.promise().query(
						"UPDATE recovery SET attempts = ? WHERE id = ?;",
						[
							attempts,
							users[0].id,
						]
					);

					res.status(HTTPStatus.BAD_REQUEST).json({
						message: "❌ Invalid pin",
					});

					return;
				}

				await mySQLPool.promise().query(
					"UPDATE user SET password = ? WHERE id = ?;",
					[
						await bcrypt.hash(passwordNew, 10),
						users[0].id,
					]
				);

				await mySQLPool.promise().query<IUser[]>(
					"DELETE FROM recovery WHERE user_id = ?;",
					[
						users[0].id,
					]
				);

				res.status(HTTPStatus.OK).json({
					message: "✅ User password updated",
				});
			}
			catch (error: Error | any)
			{
				if (error instanceof Error)
				{
					res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
						message: `${INTERNAL_SERVER_ERROR}: ${error.message}`,
					});

					return;
				}

				res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
					message: `${INTERNAL_SERVER_ERROR}: Unknown error`,
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
						req.userDecoded.email,
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
						req.userDecoded.id,
					]
				);

				res.status(HTTPStatus.OK).send("Updated password.");
			}
			catch (error: Error | any)
			{
				if (error instanceof Error)
				{
					res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
						message: `${INTERNAL_SERVER_ERROR}: ${error.message}`,
					});

					return;
				}

				res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
					message: `${INTERNAL_SERVER_ERROR}: Unknown error`,
				});
			}
		}
	);
};

