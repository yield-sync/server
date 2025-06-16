import express from "express";
import mysql from "mysql2";

import routeApiPortfolioAllocationSector from "./index";
import routeApi from "../index";
import routeApiPortfolio from "../portfolio/index";
import routeApiPortfolioAsset from "../portfolio-asset/index";
import routeApiAsset from "../stock/index";
import routeApiUser from "../user/index";
import config from "../../../config";
import { HTTPStatus } from "../../../constants";
import DBBuilder, { dBDrop } from "../../../sql/db-builder";


const request = require('supertest');


const ASSET_NAME: string = "Asset";
const ASSET_SYMBOL: string = "A";
const DB_NAME: string = "mock_db_portfolio_allocation_sector";
const EMAIL: string = "testemail@example.com";
const PASSWORD: string = "testpassword!";
const PORTFOLIO_NAME: string = "my-portfolio";

let token: string;
let stock_isin: string;
let portfolio_id: string;
let app: express.Express;
let mySQLPool: mysql.Pool;


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

	app = express().use(express.json()).use("/api", routeApi()).use(
		"/api/stock",
		routeApiAsset(mySQLPool)
	).use(
		"/api/user",
		routeApiUser(mySQLPool)
	).use(
		"/api/portfolio",
		routeApiPortfolio(mySQLPool)
	).use(
		"/api/portfolio-asset",
		routeApiPortfolioAsset(mySQLPool)
	).use(
		"/api/portfolio-allocation-sector",
		routeApiPortfolioAllocationSector(mySQLPool)
	);
});

beforeEach(async () => {
	// Drop the database
	await dBDrop(DB_NAME, mySQLPool);

	// [mock-db] drop and recreate
	await DBBuilder(mySQLPool, DB_NAME, true);

	// Create a user
	await request(app).post("/api/user/create").send({
		load: {
			email: EMAIL,
			password: PASSWORD
		}
	}).expect(HTTPStatus.CREATED);

	// Promote user to admin
	await mySQLPool.promise().query("UPDATE user SET admin = b'1' WHERE email = ?;", [EMAIL]);

	const resLogin = await request(app).post("/api/user/login").send({
		load: {
			email: EMAIL,
			password: PASSWORD
		}
	}).expect(HTTPStatus.OK);

	token = (JSON.parse(resLogin.text)).token;

	expect(typeof token).toBe("string");

	// Create a portfolio
	const resPortfolioCreate = await request(app).post("/api/portfolio/create").set(
		'authorization',
		`Bearer ${token}`
	).send({
		load: {
			name: PORTFOLIO_NAME
		} as PortfolioCreate
	});

	expect(resPortfolioCreate.statusCode).toBe(HTTPStatus.CREATED);

	const [portfolios]: MySQLQueryResult = await mySQLPool.promise().query(
		"SELECT id FROM portfolio WHERE name = ?;", [PORTFOLIO_NAME]
	);

	portfolio_id = portfolios[0].id;

	await mySQLPool.promise().query(
		"INSERT INTO stock (symbol, name, exchange, isin, sector, industry) VALUES (?, ?, ?, ?, ?, ?);",
		[
			ASSET_SYMBOL,
			ASSET_NAME,
			"nasdaq",
			"123",
			"Technology",
			"Consumer Electronics",
		]
	);

	const [assets]: MySQLQueryResult = await mySQLPool.promise().query(
		"SELECT isin FROM stock WHERE name = ?;", [ASSET_NAME]
	);

	stock_isin = assets[0].isin;
});

afterAll(async () => {
	await dBDrop(DB_NAME, mySQLPool);

	await mySQLPool.end();
});


describe("Request: GET", () => {
	describe("Route: /api/portfolio-allocation-sector/create", () => {
		describe("Expected Failure", () => {
			it("[auth] Should require a user token to insert portfolio asset into DB..", async () => {
				await request(app).post("/api/portfolio-allocation-sector/create").send({
					load: {
						portfolio_id,
						percent_allocation: 0,
						sector: "technology"
					}
				}).expect(401);

				const [results]: MySQLQueryResult = await mySQLPool.promise().query("SELECT * FROM portfolio_allocation_sector;");

				if (!Array.isArray(results)) {
					throw new Error("Expected result is not Array");
				}

				expect(results.length).toBe(0);
			});

			it("Should fail if no percent_allocation passed..", async () => {
				const RES = await request(app).post("/api/portfolio-allocation-sector/create").set(
					'authorization',
					`Bearer ${token}`
				).send({
					load: {
						portfolio_id,
						sector: "technology"
					}
				}).expect(HTTPStatus.BAD_REQUEST);

				expect(RES.body.message).toBe("❓ No percent_allocation received");

				const [results]: MySQLQueryResult = await mySQLPool.promise().query("SELECT * FROM portfolio_asset;");

				if (!Array.isArray(results)) {
					throw new Error("Expected result is not Array");
				}

				expect(results.length).toBe(0);
			});

			it("Should fail if no sector passed..", async () => {
				const RES = await request(app).post("/api/portfolio-allocation-sector/create").set(
					'authorization',
					`Bearer ${token}`
				).send({
					load: {
						portfolio_id,
						percent_allocation: 0,
					}
				}).expect(HTTPStatus.BAD_REQUEST);

				expect(RES.body.message).toBe("❓ No sector received");

				const [results]: MySQLQueryResult = await mySQLPool.promise().query("SELECT * FROM portfolio_asset;");

				if (!Array.isArray(results)) {
					throw new Error("Expected result is not Array");
				}

				expect(results.length).toBe(0);
			});
		});

		describe("Expected Success", () => {
			it("Should insert portfolio_allocation_sector into database..", async () => {
				const RES_PORTFOLIO_ASSET = await request(app).post("/api/portfolio-allocation-sector/create").set(
					'authorization',
					`Bearer ${token}`
				).send({
					load: {
						portfolio_id,
						percent_allocation: 0,
						sector: "technology"
					}
				});

				expect(RES_PORTFOLIO_ASSET.statusCode).toBe(HTTPStatus.CREATED);

				const [portfolioAllocationSector]: MySQLQueryResult = await mySQLPool.promise().query(
					"SELECT * FROM portfolio_allocation_sector;"
				);

				if (!Array.isArray(portfolioAllocationSector)) {
					throw new Error("Expected result is not Array");
				}

				expect(portfolioAllocationSector.length).toBeGreaterThan(0);

				if (!("sector" in portfolioAllocationSector[0])) {
					throw new Error("Key 'sector' not in portfolioAssets");
				}

				if (!("portfolio_id" in portfolioAllocationSector[0])) {
					throw new Error("Key 'portfolio_id' not in portfolioAssets");
				}

				if (!("percent_allocation" in portfolioAllocationSector[0])) {
					throw new Error("Key 'percent_allocation' not in portfolioAssets");
				}

				expect(portfolioAllocationSector[0].portfolio_id).toBe(portfolio_id);
			});
		});
	});
});

describe("Request: PUT", () => {
	describe("Route: /api/portfolio-allocation-sector/update/:id", () => {
		let sector_id: number;

		beforeEach(async () => {
			// Insert a valid sector allocation first
			const res = await request(app).post("/api/portfolio-allocation-sector/create").set(
				"authorization",
				`Bearer ${token}`
			).send({
				load: {
					portfolio_id,
					percent_allocation: 40,
					sector: "industrials"
				}
			}).expect(HTTPStatus.CREATED);

			const [results]: MySQLQueryResult = await mySQLPool.promise().query(
				"SELECT id FROM portfolio_allocation_sector WHERE portfolio_id = ?;",
				[portfolio_id]
			);

			if (!Array.isArray(results) || results.length === 0)
				throw new Error("Sector insert failed");

			sector_id = results[0].id;
		});

		describe("Expected Failure", () => {
			it("Should fail without auth token", async () => {
				await request(app).put(`/api/portfolio-allocation-sector/update/${sector_id}`).send({
					load: { percent_allocation: 10 }
				}).expect(HTTPStatus.UNAUTHORIZED);
			});

			it("Should fail with missing percent_allocation", async () => {
				const res = await request(app).put(`/api/portfolio-allocation-sector/update/${sector_id}`).set(
					"authorization",
					`Bearer ${token}`
				).send({ load: {} }).expect(HTTPStatus.BAD_REQUEST);

				expect(res.body.message).toBe("❓ No percent_allocation received");
			});
		});

		describe("Expected Success", () => {
			it("Should update percent_allocation for a given sector", async () => {
				const res = await request(app).put(`/api/portfolio-allocation-sector/update/${sector_id}`).set(
					"authorization",
					`Bearer ${token}`
				).send({
					load: {
						percent_allocation: 55
					}
				}).expect(HTTPStatus.CREATED);

				expect(res.body.message).toBe("portfolio_allocation_sector updated");

				const [rows]: MySQLQueryResult = await mySQLPool.promise().query(
					"SELECT percent_allocation FROM portfolio_allocation_sector WHERE id = ?;",
					[sector_id]
				);

				expect(Number(rows[0].percent_allocation)).toBe(55);
			});
		});
	});
});
