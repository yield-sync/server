import bcrypt from "bcryptjs";
import express from "express";
import mysql from "mysql";
import request from "supertest";

import routeApi from "../index";
import routeApiUser from "./index";
import config from "../../../config";
import DBBuilder, { dropDB } from "../../../sql/DBBuilder";


const jwt = require("jsonwebtoken");


const DB_NAME: string = "mock_db_user";
const ERROR_PASSWORD: string = "Password Must be ASCII, longer than 8 characters, and contain a special character";

let app: express.Express;
let dBConnection: mysql.Connection;


beforeAll(async () => {
	// [mysql] Database connection configuration
	dBConnection = mysql.createConnection({
		host: config.app.database.host,
		user: config.app.database.user,
		password: config.app.database.password,
	});

	dBConnection.connect((error: Error) =>
	{
		if (error)
		{
			throw new Error(`Failed to connect with error: ${error}`);
		}
	});

	// [mock-db] drop and recreate
	await DBBuilder(dBConnection, DB_NAME, true);

	// [mysql] Select the recreated database
	dBConnection.changeUser(
	{ database: DB_NAME },
	(error) =>
	{
		if (error)
		{
			throw new Error(String(`DB Change User Error: ${error}`));
		}
	});

	app = express().use(express.json()).use("/api", routeApi()).use("/api/user", routeApiUser(dBConnection));
})

afterAll(() =>
{
	// Drop the database
	dropDB(DB_NAME, dBConnection);

	// [mysql] Close connection
	dBConnection.end();
});

beforeEach(async () =>
{
	// Drop the database
	dropDB(DB_NAME, dBConnection);

	// [mock-db] drop and recreate
	await DBBuilder(dBConnection, DB_NAME, true);
});


// [test]
describe("ROUTE: /api/user", () =>
{
	describe("POST /create", () =>
	{
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

			dBConnection.query(
				"SELECT * FROM user;",
				async (error, results) =>
				{
					expect(results.length).toBe(0);
				}
			);
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

			dBConnection.query(
				"SELECT * FROM user;",
				async (error, results) =>
				{
					expect(results.length).toBe(0);
				}
			);
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

			dBConnection.query(
				"SELECT * FROM user;",
				async (error, results) =>
				{
					expect(results.length).toBe(0);
				}
			);
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

			dBConnection.query(
				"SELECT * FROM user;",
				async (error, results) =>
				{
					expect(results.length).toBe(0);
				}
			);
		});

		test("Should allow creating a user..", async () =>
		{
			const email = "testemail@example.com";
			const password = "testpassword!";

			const response = await request(app).post("/api/user/create").send({
				load: {
					email: email,
					password: password
				}
			});

			expect(response.statusCode).toBe(201);

			dBConnection.query(
				"SELECT * FROM user;",
				async (error, results) =>
				{
					if (error)
					{
						throw new Error(error.stack);
					}

					expect(results[0].email).toBe(email);

					// Should NOT not be the literal password but rather the hash of it
					expect(results[0].password).not.toBe(password);
				}
			);
		});

		test("Should only allow UNIQUE emails..", async () =>
		{
			const email = "testemail@example.com";
			const password = "testpassword!";

			// Create first user with unique email
			await request(app).post("/api/user/create").send({
				load: {
					email: email,
					password: password
				}
			});

			const response = await request(app).post("/api/user/create").send({
				load: {
					email: email,
					password: password
				}
			});

			expect(response.statusCode).toBe(400);

			expect(response.text).toBe("This email is already being used.");

			dBConnection.query(
				"SELECT * FROM user;",
				async (error, results) =>
				{
					if (error)
					{
						throw new Error(error.stack);

					}

					expect(results.length).toBe(1);
				}
			);
		});

		test("Should be able to decode password..", async () =>
		{
			const email = "testemail@example.com";
			const password = "testpassword!";
			const invalidPassword = "invalidPassword";

			// Create first user with unique email
			await request(app).post("/api/user/create").send({
				load: {
					email: email,
					password: password
				}
			});

			dBConnection.query(
				"SELECT * FROM user WHERE email = ?;",
				[
					email,
				],
				async (error, results) =>
				{
					// Shoud only work with the valid password
					expect(bcrypt.compareSync(password, results[0].password)).toBe(true);

					expect(bcrypt.compareSync(invalidPassword, results[0].password)).toBe(false);
				}
			);
		});
	});

	describe("POST /login", () =>
	{
		test("Should allow user to recieve a decodable token..", async () =>
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

			dBConnection.query(
				"SELECT * FROM user WHERE email = ?;",
				[
					email,
				],
				async (error, results) =>
				{
					// Verify the jwt token recieved
					jwt.verify(
						TOKEN,
						config.app.secretKey,
						async (error, decoded) =>
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
						}
					);
				}
			);
		});
	});
});
