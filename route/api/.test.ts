import express from "express";
import request from "supertest";

import routeApi from "./index";

let app: express.Express = express().use(express.json()).use("/api", routeApi());

// [test]
describe("ROUTE: /api", () =>
{
	describe("GET /", () =>
	{
		test("Should return status 200..", async () =>
		{
			const response = await request(app).get("/api/");

			expect(response.statusCode).toBe(200);
		});
	});

	describe("GET /recover-account", () =>
	{
		//test("Should be able to receive email from server")
	});
});
