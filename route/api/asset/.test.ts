import express from "express";
import mysql from "mysql2";
import request from "supertest";

import routeAPIAsset from "./index";
import routeApi from "../index";
import routeApiUser from "../user/index";
import config from "../../../config";
import DBBuilder, { dropDB } from "../../../sql/db-builder";


const ASSET_NAME: string = "Asset";
const ASSET_SYMBOL: string = "A";
const DB_NAME: string = "mock_db_asset";
const EMAIL: string = "testemail@example.com";
const PASSWORD: string = "testpassword!";

let token: string;

let app: express.Express;
let mySQLPool: mysql.Pool;


afterAll(async () =>
{
	await dropDB(DB_NAME, mySQLPool);

	await mySQLPool.end();
});

beforeAll(async () =>
{
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

	app = express().use(express.json()).use("/api", routeApi()).use("/api/user", routeApiUser(mySQLPool)).use(
		"/api/asset",
		routeAPIAsset(mySQLPool)
	);
});

beforeEach(async () =>
{
	await dropDB(DB_NAME, mySQLPool);

	await DBBuilder(mySQLPool, DB_NAME, true);

	await request(app).post("/api/user/create").send({
		load: {
			email: EMAIL,
			password: PASSWORD
		} as UserCreate
	}).expect(201);

	const resLogin = await request(app).post("/api/user/login").send({
		load: {
			email: EMAIL,
			password: PASSWORD
		} as UserLogin
	}).expect(200);

	token = (JSON.parse(resLogin.text)).token;

	expect(typeof token).toBe("string");
});


describe("Request: GET", () =>
{
	describe("Route: /api/asset/create", () =>
	{
		describe("Expected Failures", () =>
		{
			test("[auth] Should require a user token..", async () =>
			{
				await request(app).get("/api/asset/create").send().expect(401);

				const [assets]: MySQLQueryResult = await mySQLPool.promise().query("SELECT * FROM asset;");

				if (!Array.isArray(assets))
				{
					throw new Error("SQL result assets is not an Array");
				}

				expect(assets.length).toBe(0);
			});
		});

		describe("Expected Success", () =>
		{
			it("Should create an asset..", async () =>
			{
				// Create an asset
				const resAssetCreate = await request(app).get("/api/asset/create").set(
					"authorization",
					`Bearer ${token}`
				).send({
					load: {
						name: ASSET_NAME,
						symbol: ASSET_SYMBOL,
					} as AssetCreate
				});

				expect(resAssetCreate.statusCode).toBe(201);

				const [assets]: MySQLQueryResult = await mySQLPool.promise().query(
					"SELECT * FROM asset WHERE name = ?;", [ASSET_NAME]
				);

				if (!Array.isArray(assets))
				{
					throw new Error("Expected assets to be an Array");
				}

				expect(assets.length).toBeGreaterThan(0);

				if (!("name" in assets[0]))
				{
					throw new Error("Expected assets array element to have key 'name'");
				}

				expect(assets[0].name).toBe(ASSET_NAME);

				if (!("symbol" in assets[0]))
				{
					throw new Error("Expected assets array element to have key 'symbol'");
				}

				expect(assets[0].symbol).toBe(ASSET_SYMBOL);
			});
		});
	});

	describe("Route: /api/asset/update", () =>
	{
	});

	describe("Route: /api/asset/delete", () =>
	{
	});
});
