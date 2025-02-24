import express, { Express } from "express";
import request from "supertest";

import routeApi from "./index";


let app: Express = express().use(express.json()).use("/api", routeApi());


describe("Request: GET", () =>
{
	describe("Route: /api/", () =>
	{
		it("Should return status 200..", async () =>
		{
			const response = await request(app).get("/api/");

			expect(response.statusCode).toBe(200);
		});
	});

	describe("/api/recover-account", () =>
	{
		//it("Should be able to receive email from server")
	});
});
