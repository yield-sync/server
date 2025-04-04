import bcrypt from "bcryptjs";
import express, { Express } from "express";
import mysql from "mysql2";

import routeApi from "../index";
import routeApiUser from "./index";
import config from "../../../config";
import { hTTPStatus } from "../../../constants";
import DBBuilder, { dBDrop } from "../../../sql/db-builder";
import mailUtil from "../../../util/mailUtil";


const request = require('supertest');
const jwt = require("jsonwebtoken");


const DB_NAME: string = "mock_db_user";
const ERROR_PASSWORD: string = "❌ Password Must be ASCII, longer than 8 characters, and contain a special character";

const email = "testemail@example.com";
const password = "testpassword!";

let app: Express;
let mySQLPool: mysql.Pool;


jest.mock("../../../util/mailUtil.ts", () => ({
	sendRecoveryEmail: jest.fn(),
	sendVerificationEmail: jest.fn(),
}));


afterAll(async () =>
{
	await dBDrop(DB_NAME, mySQLPool);

	await mySQLPool.end();
});

beforeAll(async () => {
	mySQLPool = mysql.createPool({
		host: config.app.database.host,
		user: config.app.database.user,
		password: config.app.database.password,
		waitForConnections: true,
		connectionLimit: 10,
		queueLimit: 0
	});

	await mySQLPool.promise().getConnection();

	await DBBuilder(mySQLPool, DB_NAME, true);

	await mySQLPool.promise().query("USE ??;", [DB_NAME]);

	app = express().use(express.json()).use("/api", routeApi()).use("/api/user", routeApiUser(mySQLPool));
})

beforeEach(async () =>
{
	await dBDrop(DB_NAME, mySQLPool);

	await DBBuilder(mySQLPool, DB_NAME, true);
});


describe("Request: GET", () =>
{
	describe("Route: /api/user/", () =>
	{
		describe("❌ Expected Failure", () => {
			it("Should NOT allow creating a user with invalid email..", async () =>
			{
				const response = await request(app).get("/api/user/").send();

				expect(response.statusCode).toBe(401);
				expect(response.error.text).toBe(
					"{\"message\":\"Access denied: Invalid or missing token\"}"
				);
			});
		});

		describe("✅ Expected Success", () => {
			it("Should return JSON of user profile..", async () =>
			{
				const EMAIL: string = "testemail@example.com";
				const PASSWORD: string = "testpassword!";

				// Create a user
				await request(app).post("/api/user/create").send({
					load: {
						email: EMAIL,
						password: PASSWORD
					}
				}).expect(201);


				const resLogin = await request(app).post("/api/user/login").send({
					load: {
						email: EMAIL,
						password: PASSWORD
					}
				}).expect(200);

				const token = (JSON.parse(resLogin.text)).token;

				const response = await request(app).get("/api/user/").set(
					'authorization',
					`Bearer ${token}`
				).send();

				expect(response.statusCode).toBe(200);

				const recievedJSON = JSON.parse(response.text)

				expect(recievedJSON.email).toBe(EMAIL);

				expect(recievedJSON.admin).toBe(false);

				expect(recievedJSON.verified).toBe(false);
			});
		});

		describe("❌ Expected Failure Part 2", () => {
			it("Should state that verification is required if over 5 days from creation and not verified..", async () =>
			{
				const EMAIL: string = "testemail@example.com";
				const PASSWORD: string = "testpassword!";

				// Create a user
				await request(app).post("/api/user/create").send({
					load: {
						email: EMAIL,
						password: PASSWORD
					}
				}).expect(201);


				const resLogin = await request(app).post("/api/user/login").send({
					load: {
						email: EMAIL,
						password: PASSWORD
					}
				}).expect(200);

				const token = (JSON.parse(resLogin.text)).token;

				const [users]: MySQLQueryResult = await mySQLPool.promise().query(
					"SELECT id FROM user WHERE email = ?;",
					[EMAIL]
				);

				await mySQLPool.promise().query(
					"UPDATE user SET created = ? WHERE id = ?;",
					[
						new Date(new Date().setDate(new Date().getDate() - 6)),
						users[0].id
					]
				);

				const response = await request(app).get("/api/user/").set(
					'authorization',
					`Bearer ${token}`
				).send();

				expect(response.statusCode).toBe(401);

				expect(response.body.message).toBe(
					"Access denied: 5 days have passed since account creation. Please verify account."
				);
			});
		});
	});

	describe("Route: /api/user/send-password-recovery-email/:email", () => {
		beforeEach(() => jest.clearAllMocks());

		describe("❌ Expected Failure", () => {
			it("Should revert if an invalid email is passed to the route..", async () => {
				const res = await request(app).get("/api/user/send-password-recovery-email/not-an-email");

				expect(res.statusCode).toBe(400);
				expect(res.body.message).toBe("❌ Invalid email format");
			});

			it("Should revert if a valid email is not found in the database..", async () => {
				const res = await request(app).get("/api/user/send-password-recovery-email/missing@example.com");

				expect(res.statusCode).toBe(400);
				expect(res.body.message).toBe("❌ Email not found");
			});
		});

		describe("✅ Expected Success", () => {
			it("Should send the password recovery email..", async () => {
				await request(app).post("/api/user/create").send({ load: { email, password } });

				expect(mailUtil.sendRecoveryEmail).not.toHaveBeenCalled();

				const res = await request(app).get(`/api/user/send-password-recovery-email/${email}`);

				expect(mailUtil.sendRecoveryEmail).toHaveBeenCalled();

				expect(res.statusCode).toBe(200);

				expect(res.body.message).toBe("✅ Password recovery email sent");
			});
		});

		describe("❌ Expected Failure Part 2", () => {
			it("Should not be able to send another email until 3 minutes has passed since the last one..", async () => {
				await request(app).post("/api/user/create").send({
					load: {
						email: email,
						password: password
					}
				});

				await request(app).get(`/api/user/send-password-recovery-email/${email}`);

				await request(app).get(`/api/user/send-password-recovery-email/${email}`);

				expect(mailUtil.sendRecoveryEmail).toBeCalledTimes(1);

				const res = await request(app).get(`/api/user/send-password-recovery-email/${email}`).expect(
					hTTPStatus.TOO_MANY_REQUEST
				);

				expect(res.body.message).toBe("⏳ 3 minutes must pass before last request for recovery email");
			});
		});
	});

	describe("Route: /api/user/send-verification-email", () => {
		describe("❌ Expected Failure", () => {
			it("[auth] Should require a user token..", async () =>
			{
				await request(app).get("/api/user/send-verification-email").send().expect(401);
			});
		});

		describe("✅ Expected Success", () => {
			it("Should send the verification email..", async () => {
				await request(app).post("/api/user/create").send({ load: { email, password } });

				const [user] = await mySQLPool.promise().query<IUser>("SELECT * FROM user WHERE email = ?", [email]);

				const resLogin = await request(app).post("/api/user/login").send({
					load: {
						email,
						password
					}
				}).expect(200);

				const token = (JSON.parse(resLogin.text)).token;

				const res = await request(app).get(`/api/user/send-verification-email`).set(
					'authorization',
					`Bearer ${token}`
				).send();

				expect(res.status).toBe(200);

				expect(mailUtil.sendVerificationEmail).toHaveBeenCalled();

				const [verification] = await mySQLPool.promise().query<IVerification>(
					"SELECT * FROM verification WHERE user_id = ?",
					[user[0].id]
				);

				if (!Array.isArray(verification))
				{
					throw new Error("Expected result is not Array");
				}

				expect(verification.length).toBeGreaterThan(0);
			});
		});

		describe("❌ Expected Failure Part 2", () => {
			it("Should not be able to send another email until 3 minutes has passed since the last one..", async () => {
				await request(app).post("/api/user/create").send({ load: { email, password } });

				await mySQLPool.promise().query<IUser>("SELECT * FROM user WHERE email = ?", [email]);

				const resLogin = await request(app).post("/api/user/login").send({
					load: {
						email,
						password
					}
				}).expect(200);

				const token = (JSON.parse(resLogin.text)).token;

				await request(app).get(`/api/user/send-verification-email`).set(
					'authorization',
					`Bearer ${token}`
				).send();

				expect(mailUtil.sendVerificationEmail).toHaveBeenCalled();

				const res = await request(app).get(`/api/user/send-verification-email`).set(
					'authorization',
					`Bearer ${token}`
				).send();

				expect(res.body.message).toBe("⏳ 3 minutes must pass before last request for verification email",);
			});

			it("Should not be able to send another email if the user is already verified..", async () => {

			});
		});
	});
});

describe("Request: POST", () =>
{
	describe("Route: /api/user/create", () =>
	{
		describe("❌ Expected Failure", () => {
			it("Should NOT allow creating a user with invalid email..", async () =>
			{
				const email = "notemail";
				const password = "testtest123!@";

				const response = await request(app).post("/api/user/create").send({
					load: {
						email: email,
						password: password
					}
				});

				expect(response.statusCode).toBe(400);

				expect(response.error.text).toBe("❌ Invalid email");

				const [results]: MySQLQueryResult = await mySQLPool.promise().query(
					"SELECT * FROM user;"
				);

				expect(results).toStrictEqual([]);
			});

			it("Should NOT allow creating a user with short password..",
			async () =>
			{
				const password = "123";

				const response = await request(app).post("/api/user/create").send({
					load: {
						email: email,
						password: password
					}
				});

				expect(response.statusCode).toBe(400);

				expect(response.error.text).toBe(ERROR_PASSWORD);

				const [results]: MySQLQueryResult = await mySQLPool.promise().query(
					"SELECT * FROM user;"
				);

				expect(results).toStrictEqual([]);
			});

			it("Should NOT allow password without special characters..", async () =>
			{
				const password = "12345678";

				const response = await request(app).post("/api/user/create").send({
					load: {
						email: email,
						password: password
					}
				});

				expect(response.statusCode).toBe(400);

				expect(response.error.text).toBe(ERROR_PASSWORD);

				const [results]: MySQLQueryResult = await mySQLPool.promise().query(
					"SELECT * FROM user;"
				);

				expect(results).toStrictEqual([]);
			});

			it("Should NOT allow creating a user with non-ASCII password..", async () =>
			{
				// Contains non-ASCII character
				const password = "!12345678¢";

				const res = await request(app).post("/api/user/create").send({
					load: {
						email: email,
						password: password
					}
				});

				expect(res.statusCode).toBe(400);

				expect(res.error.text).toBe(ERROR_PASSWORD);

				const [results]: MySQLQueryResult = await mySQLPool.promise().query(
					"SELECT * FROM user;"
				);

				expect(results).toStrictEqual([]);
			});
		});

		describe("✅ Expected Success", () =>
		{
			const email: string = "testemail@example.com";
			const password: string = "testpassword!";

			let results: any;

			beforeEach(async () =>
			{
				const response = await request(app).post("/api/user/create").send({
					load: {
						email: email,
						password: password
					}
				});

				expect(response.statusCode).toBe(201);

				[results] = await mySQLPool.promise().query("SELECT * FROM user;");
			});

			it("Should allow creating a user..", async () =>
			{
				expect(results[0].email).toBe(email);

				// Should NOT not be the literal password but rather the hash of it
				expect(results[0].password).not.toBe(password);
			});

			it("Should be able to decode password..", async () =>
			{
				const invalidPassword = "invalidPassword";

				// Shou/d only work with the valid password
				expect(bcrypt.compareSync(password, results[0].password)).toBe(true);

				expect(bcrypt.compareSync(invalidPassword, results[0].password)).toBe(false);
			});

			it("Should only allow UNIQUE emails..", async () =>
			{
				const response = await request(app).post("/api/user/create").send({
					load: {
						email: email,
						password: password
					}
				});

				expect(response.statusCode).toBe(400);

				expect(JSON.parse(response.text).message).toBe("❌ This email is already being used.");

				const [results]: MySQLQueryResult = await mySQLPool.promise().query(
					"SELECT * FROM user;"
				);

				if (!Array.isArray(results))
				{
					throw new Error("Expected result is not Array");
				}

				expect(results.length).toBe(1);
			});
		});
	});

	describe("Route: /api/user/login", () =>
	{
		it("Should allow user to receive a decodable token..", async () =>
		{
			const email: string = "testemail@example.com";
			const password: string = "testpassword!";

			// Create a user
			await request(app).post("/api/user/create").send({
				load: {
					email: email,
					password: password
				}
			});

			const response = await request(app).post("/api/user/login").send({
				load: {
					email: email,
					password: password
				}
			});

			expect(response.statusCode).toBe(200);

			const TOKEN = (JSON.parse(response.text)).token;

			expect(typeof TOKEN).toBe("string");

			const [results]: MySQLQueryResult = await mySQLPool.promise().query(
				"SELECT * FROM user WHERE email = ?;",
				[email]
			);

			// Verify the jwt token recieved
			jwt.verify(TOKEN, config.app.secretKey, async (error, decoded) =>
			{
				if (error)
				{
					throw new Error(String(`JWT Verify Error: ${error}`));
				}

				if (decoded)
				{
					expect(decoded.id).toBe(results[0].id);
					expect(decoded.email).toBe(results[0].email);
				}
			});
		});
	});

	describe("Route: /api/user/password-update", () =>
	{
		it("Should not allow user to change password given invalid current password..", async () =>
		{
			const email: string = "testemail@example.com";
			const password: string = "testpassword!";
			const PASSWORD_INVALID: string = "testpassword!!";

			// Create a user
			await request(app).post("/api/user/create").send({
				load: {
					email: email,
					password: password
				}
			});

			const response = await request(app).post("/api/user/login").send({
				load: {
					email: email,
					password: password
				}
			});

			expect(response.statusCode).toBe(200);

			const TOKEN = (JSON.parse(response.text)).token;

			expect(typeof TOKEN).toBe("string");

			await request(app).post("/api/user/password-update").set(
				'authorization',
				`Bearer ${TOKEN}`
			).send({
				load: {
					password: PASSWORD_INVALID,
					passwordNew: PASSWORD_INVALID,
				}
			}).expect(401);
		});

		it("Should allow user to change password given old one..", async () =>
		{
			const email: string = "testemail@example.com";
			const password: string = "testpassword!";
			const PASSWORD_NEW: string = "testpassword!!";

			// Create a user
			await request(app).post("/api/user/create").send({
				load: {
					email: email,
					password: password
				}
			});

			const response = await request(app).post("/api/user/login").send({
				load: {
					email: email,
					password: password
				}
			});

			expect(response.statusCode).toBe(200);

			const TOKEN = (JSON.parse(response.text)).token;

			expect(typeof TOKEN).toBe("string");

			await request(app).post("/api/user/password-update").set(
				'authorization',
				`Bearer ${TOKEN}`
			).send({
				load: {
					password: password,
					passwordNew: PASSWORD_NEW,
				}
			}).expect(200);

			const RESPONSE_LOGIN_NEW = await request(app).post("/api/user/login").send({
				load: {
					email: email,
					password: PASSWORD_NEW
				}
			});

			expect(RESPONSE_LOGIN_NEW.statusCode).toBe(200);

			const TOKEN_NEW = (JSON.parse(RESPONSE_LOGIN_NEW.text)).token;

			expect(typeof TOKEN_NEW).toBe("string");
		});
	});

	describe("Route: /api/user/verify", () => {
		describe("❌ Expected Failure", () => {
			it("[auth] Should require a user token..", async () =>
			{
				await request(app).post("/api/user/verify").send().expect(401);
			});

			it("[auth] Should require a valid user token..", async () => {
				const res = await request(app).post("/api/user/verify").send({
					token: "invalid.token.value"
				});

				expect(res.statusCode).toBe(401);

				expect(res.body.message).toBe("Access denied: Invalid or missing token");
			});
		});

		describe("✅ Expected Success", () => {
			it("Should verify a user with a valid token..", async () => {
				await request(app).post("/api/user/create").send({ load: { email, password } });

				const [user] = await mySQLPool.promise().query<IUser>("SELECT * FROM user WHERE email = ?", [email]);

				const resLogin = await request(app).post("/api/user/login").send({
					load: {
						email,
						password
					}
				}).expect(200);

				const token = (JSON.parse(resLogin.text)).token;

				await request(app).get(`/api/user/send-verification-email`).set(
					'authorization',
					`Bearer ${token}`
				).send();

				const [verification] = await mySQLPool.promise().query<IVerification>(
					"SELECT * FROM verification WHERE user_id = ?",
					[user[0].id]
				);

				const res = await request(app).post("/api/user/verify").set(
					'authorization',
					`Bearer ${token}`
				).send({
					load: {
						pin: verification[0].pin
					}
				});

				expect(res.statusCode).toBe(200);

				expect(res.body.message).toBe("✅ Email verified");

				const [userUpdated] = await mySQLPool.promise().query<IUser>(
					"SELECT verified FROM user WHERE id = ?",
					[user[0].id]
				);

				expect(userUpdated[0].verified[0]).toBe(1);
			});
		});
	});

	describe("Route: /api/user/recover-password/:email", () => {

	});
});
