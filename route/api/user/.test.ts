import bcrypt from "bcryptjs";
import express, { Express } from "express";
import mysql from "mysql2";

import routeApi from "../index";
import routeApiUser from "./index";
import config from "../../../config";
import { HTTPStatus } from "../../../constants";
import rateLimiter from "../../../rate-limiter";
import DBBuilder, { dBDrop } from "../../../sql/db-builder";
import mailUtil from "../../../util/mailUtil";


const request = require("supertest");
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
		describe("Expected Failure", () => {
			it("Should NOT allow creating a user with invalid email..", async () =>
			{
				const response = await request(app).get("/api/user/").send();

				expect(response.statusCode).toBe(401);
				expect(response.error.text).toBe(
					"{\"message\":\"Access denied: Invalid or missing token\"}"
				);
			});
		});

		describe("Expected Success", () => {
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
				}).expect(HTTPStatus.CREATED);


				const resLogin = await request(app).post("/api/user/login").send({
					load: {
						email: EMAIL,
						password: PASSWORD
					}
				}).expect(HTTPStatus.OK);

				const token = (JSON.parse(resLogin.text)).token;

				const response = await request(app).get("/api/user/").set(
					"authorization",
					`Bearer ${token}`
				).send();

				expect(response.statusCode).toBe(HTTPStatus.OK);

				const recievedJSON = JSON.parse(response.text)

				expect(recievedJSON.email).toBe(EMAIL);

				expect(recievedJSON.admin).toBe(false);

				expect(recievedJSON.verified).toBe(false);
			});
		});

		describe("Expected Failure Part 2", () => {
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
				}).expect(HTTPStatus.CREATED);


				const resLogin = await request(app).post("/api/user/login").send({
					load: {
						email: EMAIL,
						password: PASSWORD
					}
				}).expect(HTTPStatus.OK);

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
					"authorization",
					`Bearer ${token}`
				).send();

				expect(response.statusCode).toBe(401);

				expect(response.body.message).toBe(
					"Access denied: 5 days have passed since account creation. Please verify account."
				);
			});
		});
	});

	describe("Route: /api/user/password-recovery/send-email/:email", () => {
		beforeEach(() => jest.clearAllMocks());

		describe("Expected Failure", () => {
			it("Should revert if an invalid email is passed to the route..", async () => {
				const res = await request(app).get("/api/user/password-recovery/send-email/not-an-email");

				expect(res.statusCode).toBe(HTTPStatus.BAD_REQUEST);
				expect(res.body.message).toBe("❌ Invalid email format");
			});

			it("Should revert if a valid email is not found in the database..", async () => {
				const res = await request(app).get("/api/user/password-recovery/send-email/missing@example.com");

				expect(res.statusCode).toBe(HTTPStatus.BAD_REQUEST);
				expect(res.body.message).toBe("❌ Email not found");
			});
		});

		describe("Expected Success", () => {
			it("Should send the password recovery email..", async () => {
				await request(app).post("/api/user/create").send({ load: { email, password } });

				expect(mailUtil.sendRecoveryEmail).not.toHaveBeenCalled();

				const res = await request(app).get(`/api/user/password-recovery/send-email/${email}`);

				expect(mailUtil.sendRecoveryEmail).toHaveBeenCalled();

				expect(res.statusCode).toBe(HTTPStatus.OK);

				expect(res.body.message).toBe("✅ Password recovery email sent");
			});
		});

		describe("Expected Failure Part 2", () => {
			it("allows up to 5 requests..", async () => {
				// Create a user
				await request(app).post("/api/user/create").send({
					load: {
						email,
						password
					}
				}).expect(HTTPStatus.CREATED);

				// Reset rate limit here
				rateLimiter.emailRateLimiter.resetKey("::ffff:127.0.0.1");

				for (let i = 0; i < 5; i++)
				{
					await request(app).get(`/api/user/password-recovery/send-email/${email}`).expect(HTTPStatus.OK);
				}

				expect(mailUtil.sendRecoveryEmail).toBeCalledTimes(5);

				const res = await request(app).get(`/api/user/password-recovery/send-email/${email}`).expect(
					HTTPStatus.TOO_MANY_REQUEST
				);

				expect(res.text).toBe("⏳ Too many requests, please try again in 2 hours");
			});
		});
	});

	describe("Route: /api/user/verification/send-verification", () => {
		describe("Expected Failure", () => {
			it("[auth] Should require a user token..", async () =>
			{
				await request(app).get("/api/user/verification/send-verification").send().expect(401);
			});
		});

		describe("Expected Success", () => {
			it("Should send the verification email..", async () => {
				// Reset rate limit here
				rateLimiter.emailRateLimiter.resetKey("::ffff:127.0.0.1");

				await request(app).post("/api/user/create").send({ load: { email, password } });

				const [user] = await mySQLPool.promise().query<IUser>("SELECT * FROM user WHERE email = ?", [email]);

				const resLogin = await request(app).post("/api/user/login").send({
					load: {
						email,
						password
					}
				}).expect(HTTPStatus.OK);

				const token = (JSON.parse(resLogin.text)).token;

				const res = await request(app).get(`/api/user/verification/send-verification`).set(
					"authorization",
					`Bearer ${token}`
				).send();

				expect(res.status).toBe(HTTPStatus.OK);

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

		describe("Expected Failure Part 2", () => {
			it("allows up to 5 requests..", async () => {
				// Reset rate limit here
				rateLimiter.emailRateLimiter.resetKey("::ffff:127.0.0.1");

				// Create a user
				await request(app).post("/api/user/create").send({
					load: {
						email,
						password
					}
				}).expect(HTTPStatus.CREATED);

				const [user] = await mySQLPool.promise().query<IUser>("SELECT * FROM user WHERE email = ?", [email]);

				const resLogin = await request(app).post("/api/user/login").send({
					load: {
						email,
						password
					}
				}).expect(HTTPStatus.OK);

				const token = (JSON.parse(resLogin.text)).token;


				for (let i = 0; i < 5; i++)
				{
					await request(app).get(`/api/user/verification/send-verification`).set(
						"authorization",
						`Bearer ${token}`
					).expect(HTTPStatus.OK);
				}

				expect(mailUtil.sendRecoveryEmail).toBeCalledTimes(5);

				const res = await request(app).get(`/api/user/verification/send-verification`).set(
					"authorization",
					`Bearer ${token}`
				).expect(
					HTTPStatus.TOO_MANY_REQUEST
				);

				expect(res.text).toBe("⏳ Too many requests, please try again in 2 hours");
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
		describe("Expected Failure", () => {
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

				expect(response.statusCode).toBe(HTTPStatus.BAD_REQUEST);

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

				expect(response.statusCode).toBe(HTTPStatus.BAD_REQUEST);

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

				expect(response.statusCode).toBe(HTTPStatus.BAD_REQUEST);

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

				expect(res.statusCode).toBe(HTTPStatus.BAD_REQUEST);

				expect(res.error.text).toBe(ERROR_PASSWORD);

				const [results]: MySQLQueryResult = await mySQLPool.promise().query(
					"SELECT * FROM user;"
				);

				expect(results).toStrictEqual([]);
			});
		});

		describe("Expected Success", () =>
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

				expect(response.statusCode).toBe(HTTPStatus.CREATED);

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

				expect(response.statusCode).toBe(HTTPStatus.BAD_REQUEST);

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

			expect(response.statusCode).toBe(HTTPStatus.OK);

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

			expect(response.statusCode).toBe(HTTPStatus.OK);

			const TOKEN = (JSON.parse(response.text)).token;

			expect(typeof TOKEN).toBe("string");

			await request(app).post("/api/user/password-update").set(
				"authorization",
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

			expect(response.statusCode).toBe(HTTPStatus.OK);

			const TOKEN = (JSON.parse(response.text)).token;

			expect(typeof TOKEN).toBe("string");

			await request(app).post("/api/user/password-update").set(
				"authorization",
				`Bearer ${TOKEN}`
			).send({
				load: {
					password: password,
					passwordNew: PASSWORD_NEW,
				}
			}).expect(HTTPStatus.OK);

			const RESPONSE_LOGIN_NEW = await request(app).post("/api/user/login").send({
				load: {
					email: email,
					password: PASSWORD_NEW
				}
			});

			expect(RESPONSE_LOGIN_NEW.statusCode).toBe(HTTPStatus.OK);

			const TOKEN_NEW = (JSON.parse(RESPONSE_LOGIN_NEW.text)).token;

			expect(typeof TOKEN_NEW).toBe("string");
		});
	});

	describe("Route: /api/user/verification/verify", () => {
		describe("Expected Failure", () => {
			it("[auth] Should require a user token..", async () =>
			{
				await request(app).post("/api/user/verification/verify").send().expect(401);
			});

			it("[auth] Should require a valid user token..", async () => {
				const res = await request(app).post("/api/user/verification/verify").send({
					token: "invalid.token.value"
				});

				expect(res.statusCode).toBe(401);

				expect(res.body.message).toBe("Access denied: Invalid or missing token");
			});

			it("Should not verify if no verification found..", async () => {
				/**
				* @dev There is a 1/(36^6) chance that this fails (lol)
				*/
				rateLimiter.emailRateLimiter.resetKey("::ffff:127.0.0.1");

				await request(app).post("/api/user/create").send({ load: { email, password } });

				const resLogin = await request(app).post("/api/user/login").send({
					load: {
						email,
						password
					}
				}).expect(HTTPStatus.OK);

				const token = (JSON.parse(resLogin.text)).token;

				const res = await request(app).post("/api/user/verification/verify").set(
					"authorization",
					`Bearer ${token}`
				).send({
					load: {
						pin: "000000"
					}
				});
				expect(res.statusCode).toBe(HTTPStatus.BAD_REQUEST);

				expect(res.body.message).toBe("❌ No verification found");
			});

			it("Should not verify if invalid pin passed..", async () => {
				/**
				* @dev There is a 1/(36^6) chance that this fails (lol)
				*/
				rateLimiter.emailRateLimiter.resetKey("::ffff:127.0.0.1");

				await request(app).post("/api/user/create").send({ load: { email, password } });

				const resLogin = await request(app).post("/api/user/login").send({
					load: {
						email,
						password
					}
				}).expect(HTTPStatus.OK);

				const token = (JSON.parse(resLogin.text)).token;

				await request(app).get(`/api/user/verification/send-verification`).set(
					"authorization",
					`Bearer ${token}`
				).send().expect(HTTPStatus.OK);

				const res = await request(app).post("/api/user/verification/verify").set(
					"authorization",
					`Bearer ${token}`
				).send({
					load: {
						pin: "000000"
					}
				});
				expect(res.statusCode).toBe(HTTPStatus.BAD_REQUEST);

				expect(res.body.message).toBe("❌ Invalid pin");
			});

			it("Should delete verification if 3 invalid pins passed..", async () => {
				/**
				* @dev There is a 1/(36^6) chance that this fails (lol)
				*/
				rateLimiter.emailRateLimiter.resetKey("::ffff:127.0.0.1");

				await request(app).post("/api/user/create").send({ load: { email, password } });

				const resLogin = await request(app).post("/api/user/login").send({
					load: {
						email,
						password
					}
				}).expect(HTTPStatus.OK);

				const token = (JSON.parse(resLogin.text)).token;

				await request(app).get(`/api/user/verification/send-verification`).set(
					"authorization",
					`Bearer ${token}`
				).send().expect(HTTPStatus.OK);


				for (let i = 0; i < 2; i++)
				{
					const res = await request(app).post("/api/user/verification/verify").set(
						"authorization",
						`Bearer ${token}`
					).send({
						load: {
							pin: "000000"
						}
					}).expect(HTTPStatus.BAD_REQUEST);

					expect(res.body.message).toBe("❌ Invalid pin");
				}

				const res = await request(app).post("/api/user/verification/verify").set(
					"authorization",
					`Bearer ${token}`
				).send({
					load: {
						pin: "000000"
					}
				});

				expect(res.statusCode).toBe(HTTPStatus.BAD_REQUEST);

				expect(res.body.message).toBe("❌ Invalid pin and attempts exceeded");

				const [user] = await mySQLPool.promise().query<IUser>("SELECT * FROM user WHERE email = ?", [email]);

				const [verification] = await mySQLPool.promise().query<IVerification>(
					"SELECT * FROM verification WHERE user_id = ?",
					[user[0].id]
				);

				if (!Array.isArray(verification))
				{
					throw new Error("Expected result is not Array");
				}

				expect(verification.length).toBe(0);
			});
		});

		describe("Expected Success", () => {
			it("Should verify a user with a valid token..", async () => {
				rateLimiter.emailRateLimiter.resetKey("::ffff:127.0.0.1");

				await request(app).post("/api/user/create").send({ load: { email, password } });

				const [user] = await mySQLPool.promise().query<IUser>("SELECT * FROM user WHERE email = ?", [email]);

				const resLogin = await request(app).post("/api/user/login").send({
					load: {
						email,
						password
					}
				}).expect(HTTPStatus.OK);

				const token = (JSON.parse(resLogin.text)).token;

				await request(app).get(`/api/user/verification/send-verification`).set(
					"authorization",
					`Bearer ${token}`
				).send().expect(HTTPStatus.OK);

				const [verification] = await mySQLPool.promise().query<IVerification>(
					"SELECT * FROM verification WHERE user_id = ?",
					[user[0].id]
				);

				const res = await request(app).post("/api/user/verification/verify").set(
					"authorization",
					`Bearer ${token}`
				).send({
					load: {
						pin: verification[0].pin
					}
				});

				expect(res.statusCode).toBe(HTTPStatus.OK);

				expect(res.body.message).toBe("✅ Email verified");

				const [userUpdated] = await mySQLPool.promise().query<IUser>(
					"SELECT verified FROM user WHERE id = ?",
					[user[0].id]
				);

				expect(userUpdated[0].verified[0]).toBe(1);
			});
		});
	});

	describe("Route: /api/user/password-recovery/recover/:email", () => {
		describe("Expected Failure", () => {
			it("Should not recover password if no recovery found..", async () => {
				/**
				* @dev There is a 1/(36^6) chance that this fails (lol)
				*/
				// Reset rate limit here
				rateLimiter.emailRateLimiter.resetKey("::ffff:127.0.0.1");

				// Create a user
				await request(app).post("/api/user/create").send({
					load: {
						email,
						password
					}
				}).expect(HTTPStatus.CREATED);

				const res = await request(app).post(`/api/user/password-recovery/recover/${email}`).send({
					load: {
						pin: "000000",
						passwordNew: password
					}
				}).expect(HTTPStatus.BAD_REQUEST);

				expect(res.body.message).toBe("❌ No recovery found");
			});

			it("Should catch if an invalid pin passed..", async () => {
				/**
				* @dev There is a 1/(36^6) chance that this fails (lol)
				*/
				// Reset rate limit here
				rateLimiter.emailRateLimiter.resetKey("::ffff:127.0.0.1");

				// Create a user
				await request(app).post("/api/user/create").send({
					load: {
						email,
						password
					}
				}).expect(HTTPStatus.CREATED);

				await request(app).get(`/api/user/password-recovery/send-email/${email}`).expect(HTTPStatus.OK);

				const res = await request(app).post(`/api/user/password-recovery/recover/${email}`).send({
					load: {
						pin: "000000",
						passwordNew: password
					}
				}).expect(HTTPStatus.BAD_REQUEST);

				expect(res.body.message).toBe("❌ Invalid pin");
			});

			it("allows up to 5 requests..", async () => {
				/**
				* @dev There is a 1/(36^6) chance that this fails (lol)
				*/
				// Reset rate limit here
				rateLimiter.emailRateLimiter.resetKey("::ffff:127.0.0.1");

				// Create a user
				await request(app).post("/api/user/create").send({
					load: {
						email,
						password
					}
				}).expect(HTTPStatus.CREATED);

				await request(app).get(`/api/user/password-recovery/send-email/${email}`).expect(HTTPStatus.OK);

				for (let i = 0; i < 2; i++)
				{
					const res = await request(app).post(`/api/user/password-recovery/recover/${email}`).send({
						load: {
							pin: "000000",
							passwordNew: password
						}
					}).expect(HTTPStatus.BAD_REQUEST);

					expect(res.body.message).toBe("❌ Invalid pin");
				}

				const res = await request(app).post(`/api/user/password-recovery/recover/${email}`).send({
					load: {
						pin: "000000",
						passwordNew: password
					}
				});

				expect(res.body.message).toBe("❌ Invalid pin and attempts exceeded");

				expect(res.status).toBe(HTTPStatus.TOO_MANY_REQUEST);
			});
		});

		describe("Expected Sucess", () => {
			it("Should change password with valid pin..", async () => {
				// Reset rate limit here
				rateLimiter.emailRateLimiter.resetKey("::ffff:127.0.0.1");

				// Create a user
				await request(app).post("/api/user/create").send({
					load: {
						email,
						password
					}
				}).expect(HTTPStatus.CREATED);

				await request(app).get(`/api/user/password-recovery/send-email/${email}`).expect(HTTPStatus.OK);

				const [user] = await mySQLPool.promise().query<IUser>("SELECT * FROM user WHERE email = ?", [email]);

				const [recovery] = await mySQLPool.promise().query<IVerification>(
					"SELECT * FROM recovery WHERE user_id = ?",
					[user[0].id]
				);

				if (!Array.isArray(recovery))
				{
					throw new Error("Expected result is not Array");
				}

				const res = await request(app).post(`/api/user/password-recovery/recover/${email}`).send({
					load: {
						pin: recovery[0].pin,
						passwordNew: "somenewpassword123!"
					}
				}).expect(HTTPStatus.OK);

				expect(res.body.message).toBe("✅ User password updated");

				const resLogin = await request(app).post("/api/user/login").send({
					load: {
						email,
						password: "somenewpassword123!"
					}
				}).expect(HTTPStatus.OK);

				const token = (JSON.parse(resLogin.text)).token;

				expect(typeof token).toBe("string");
			});
		});
	});
});
