import bcrypt from "bcryptjs";
import express from "express";
import mysql from "mysql2";

import config from "../../../config";
import { user } from "../../../middleware/token";
import mailUtil from "../../../util/mailUtil";
import { validateEmail, validatePassword } from "../../../util/validation";
import { hTTPStatus } from "../../../constants";


const jsonWebToken = require("jsonwebtoken");

const ERROR_INVALID_PASSWORD: string = "Password Must be ASCII, longer than 8 characters, and contain a special character";


export default (mySQLPool: mysql.Pool): express.Router =>
{
	return express.Router().get(
		/**
		* @route get /api/user/
		* @desc User profile
		* @access User
		*/
		"/",
		user(mySQLPool),
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
			catch (error)
			{
				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).json({ message: "Internal Server Error", error });

				return;
			}
		}
	).get(
		/**
		* @route get /api/user/send-recovery-email
		* @access Public
		*/
		"/send-recovery-email",
		async (req: express.Request, res: express.Response) =>
		{
			const { email, }: UserSendRecoveryEmail = req.body.load;

			try
			{
				await mailUtil.sendRecoveryEmail(email);

				res.status(hTTPStatus.OK).send();
			}
			catch (error)
			{
				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).json({ message: "Internal Server Error", error });

				return;
			}
		}
	).get(
		/**
		* @route GET /api/user/send-verification-email
		* @access User
		*/
		"/send-verification-email",
		user(mySQLPool, false),
		async (req: express.Request, res: express.Response) =>
		{
			try
			{
				mailUtil.setVerificationEmail(req.body.userDecoded.email);

				res.status(hTTPStatus.OK).send();
			}
			catch (error)
			{
				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).json({ message: "Internal Server Error", error });

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
					res.status(hTTPStatus.BAD_REQUEST).send("Invalid email");

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
					res.status(hTTPStatus.BAD_REQUEST).send("This email is already being used.");

					return;
				}

				await mySQLPool.promise().query(
					"INSERT INTO user (email, password) VALUES (?, ?);",
					[
						email,
						await bcrypt.hash(password, 10),
					]
				);

				// Send Email
				await mailUtil.setVerificationEmail(email);

				res.status(hTTPStatus.CREATED).send("Created user");

				return;
			}
			catch (error)
			{
				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).json({ message: "Internal Server Error", error });

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
		user(mySQLPool),
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
					res.status(401).send("Invalid password.");

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

				return;
			}
			catch (error)
			{
				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).json({ message: "Internal Server Error", error });

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
					res.status(401).send("Invalid password or email");

					return;
				}

				if (!bcrypt.compareSync(password, users[0].password))
				{
					res.status(401).send("Invalid password or email");

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

				return;
			}
			catch (error)
			{
				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).json({ message: "Internal Server Error", error });

				return;
			}
		}
	).post(
		/**
		* @route POST /api/user/verify
		* @access Public
		*/
		"/verify",
		user(mySQLPool, false),
		async (req: express.Request, res: express.Response) =>
		{
			const { pin }: UserVerify = req.body.load;

			try
			{
				res.status(hTTPStatus.OK).json({
					message: "Verified",
				});
			}
			catch (error)
			{
				res.status(hTTPStatus.INTERNAL_SERVER_ERROR).json({ message: "Internal Server Error", error });

				return;
			}
		}
	);
};

