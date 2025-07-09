/**
* @dev This script sets up a WebSocket client to connect to the Polygon.io delayed stock feed.
*/
import mysql from "mysql2";

import config from "./config";

import { websocketClient } from "@polygon.io/client-js";
import { sys } from "typescript";

require("dotenv").config();


const webSocketStockFeed = async () =>
{

	// Create MySQL pool
	const MYSQL_POOL: mysql.Pool = mysql.createPool({
		host: config.app.database.host,
		database: config.app.database.name,
		password: config.app.database.password,
		port: Number(config.app.database.port),
		user: config.app.database.user,
		waitForConnections: true,
		connectionLimit: 10,
		queueLimit: 0,
	}).on("connection", (connection) =>
	{
		console.log("✅ Server successfully connected to the MySQL Database");
	}).on("error", (err) =>
	{
		console.error("MySQL Create Pool Error:", err);
	});

	if (process.env.API__POLYGON__ENABLE_WEBSOCKET_STOCK_FEED !== "true")
	{
		console.log("🔴 Polygon Websocket Stock Feed Disabled");
	}
	else if (!process.env.API__POLYGON__KEY)
	{
		console.error("❌ Polygon Websocket Stock Feed Error: API key not set in environment variables");
		sys.exit(1);
	}
	else
	{
		console.log("🔵 Polygon Websocket Stock Feed Running");

		// create a 15-min delay websocket client using the polygon client-js library
		const ws  = websocketClient(process.env.API__POLYGON__KEY, "wss://delayed.polygon.io").stocks();

		// register a handler to log errors
		ws.onerror = (err) =>
		{
			return console.log("Failed to connect", err);
		};

		// register a handler when messages are received
		ws.onmessage = async (msg) =>
		{
			// parse the data from the message
			const parsedMessage = JSON.parse(msg.data);

			// wait until the message saying authentication was successful, then subscribe to a channel
			if (parsedMessage[0].ev === "status" && parsedMessage[0].status === "auth_success")
			{
				console.log("Subscribing to the minute aggregates channel for ALL stocks..");

				ws.send(
					JSON.stringify({
						action: "subscribe",
						params: "AM.*",
					})
				);
			}

			// Check for candlestick (minute aggregate) data
			for (const data of parsedMessage)
			{
				if (data.ev === "AM") {
					// Example fields: { ev: "AM", sym: "AAPL", o: 123, c: 124, h: 125, l: 122, v: 1000, a: 123.5, s: 1620000000, e: 1620000060 }
					try
					{
						await MYSQL_POOL.promise().query(
							`
								INSERT INTO
									stock_1m_candle (symbol, open, close, high, low, volume, avg, start, end)
								VALUES
									(?, ?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?), FROM_UNIXTIME(?))
								;
							`,
							[
								data.sym,
								data.o,
								data.c,
								data.h,
								data.l,
								data.v,
								data.a,
								Math.floor(data.s / 1000),
								Math.floor(data.e / 1000)
							]
						);
					}
					catch (err)
					{
						console.error("DB insert error:", err);
					}
				}
			}

			console.log("Message received:", parsedMessage);
		};

		// register a handler to log info if websocket closes
		ws.onclose = (code, reason) =>
		{
			return console.log("Polygon Websocket Stock Feed Connection closed", code, reason);
		};
	}
};

webSocketStockFeed();
