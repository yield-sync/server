import bcrypt from "bcryptjs";
import express, { Express } from "express";
import mysql from "mysql2";

import routeApi from "../index";
import routeApiUser from "./index";
import config from "../../../config";
import DBBuilder, { dropDB } from "../../../sql/db-builder";


const request = require('supertest');
const jwt = require("jsonwebtoken");


const DB_NAME: string = "mock_db_user";
const ERROR_PASSWORD: string = "Password Must be ASCII, longer than 8 characters, and contain a special character";

let app: Express;
let mySQLPool: mysql.Pool;


afterAll(async () =>
{
	// Drop the database (should await)
	await dropDB(DB_NAME, mySQLPool);

	// Close connection (should await)
	await mySQLPool.end();
});

beforeAll(async () => {
	// [mysql] Database connection configuration
	mySQLPool = mysql.createPool({
		host: config.app.database.host,
		user: config.app.database.user,
		password: config.app.database.password,
		waitForConnections: true,
		connectionLimit: 10,
		queueLimit: 0
	});

	// [mysql] Connect
	await mySQLPool.promise().getConnection();

	// [mock-db] drop and recreate
	await DBBuilder(mySQLPool, DB_NAME, true);

	// [mysql] Select the recreated database
	await mySQLPool.promise().query("USE ??;", [DB_NAME]);

	app = express().use(express.json()).use("/api", routeApi()).use("/api/user", routeApiUser(mySQLPool));
})

beforeEach(async () =>
{
	// Drop the database
	await dropDB(DB_NAME, mySQLPool);

	// [mock-db] drop and recreate
	await DBBuilder(mySQLPool, DB_NAME, true);
});


// [test]
describe("ROUTE: /api/user", () =>
{
	describe("GET", () =>
	{
		describe("/", () =>
		{
			describe("Expected Failures", () => {
				test("Should NOT allow creating a user with invalid email..", async () =>
				{
					const response = await request(app).get("/api/user/").send();

					expect(response.statusCode).toBe(401);
					expect(response.error.text).toBe(
						"{\"message\":\"Access denied: Invalid or missing token\"}"
					);
				});
			});

			describe("Expected Success", () => {
				test("Should return JSON of user profile..", async () =>
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

					// Send a login request
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
			})
		});
	});

	describe("POST", () =>
	{
		describe("/create", () =>
		{
			describe("Expected Failures", () => {
				test("Should NOT allow creating a user with invalid email..", async () =>
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

					expect(response.error.text).toBe("Invalid email");

					const [results]: MySQLQueryResult = await mySQLPool.promise().query(
						"SELECT * FROM user;"
					);

					expect(results).toStrictEqual([]);
				});

				test("Should NOT allow creating a user with short password..",
				async () =>
				{
					const email = "testemail@example.com";
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

				test("Should NOT allow password without special characters..", async () =>
				{
					const email = "testemail@example.com";
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

				test("Should NOT allow creating a user with non-ASCII password..", async () =>
				{
					const email = "testemail@example.com";

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

					expect(response.statusCode).toBe(201);

					[results] = await mySQLPool.promise().query("SELECT * FROM user;");
				});

				test("Should allow creating a user..", async () =>
				{
					expect(results[0].email).toBe(email);

					// Should NOT not be the literal password but rather the hash of it
					expect(results[0].password).not.toBe(password);
				});

				test("Should be able to decode password..", async () =>
				{
					const invalidPassword = "invalidPassword";

					// Shou/d only work with the valid password
					expect(bcrypt.compareSync(password, results[0].password)).toBe(true);

					expect(bcrypt.compareSync(invalidPassword, results[0].password)).toBe(false);
				});

				test("Should only allow UNIQUE emails..", async () =>
				{
					const response = await request(app).post("/api/user/create").send({
						load: {
							email: email,
							password: password
						}
					});

					expect(response.statusCode).toBe(400);

					expect(response.text).toBe("This email is already being used.");

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

		describe("/login", () =>
		{
			test("Should allow user to receive a decodable token..", async () =>
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

				// Send a login request
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

		describe("/password-update", () =>
		{
			test("Should not allow user to change password given invalid current password..", async () =>
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

				// Send a login request
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

			test("Should allow user to change password given old one..", async () =>
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

				// Send a login request
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

				// Send a login request
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
	});
});
