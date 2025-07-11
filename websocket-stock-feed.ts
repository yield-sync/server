/**
* @dev This script sets up a WebSocket client to connect to the Polygon.io delayed stock feed.
*/
import mysql from "mysql2";

import { websocketClient } from "@polygon.io/client-js";
import { sys } from "typescript";

require("dotenv").config();


const BLACK_LISTED_SYMBOLS = new Set<string>(["TpC", "TPC"]);


export default async (mySQLPool: mysql.Pool) =>
{
	if (process.env.API__POLYGON__ENABLE_WEBSOCKET_STOCK_FEED !== "true")
	{
		console.log("🔴 [websocket-stock-feed] Polygon Websocket Stock Feed Disabled");
	}
	else if (!process.env.API__POLYGON__KEY)
	{
		console.error(
			"❌ [websocket-stock-feed] Polygon Websocket Stock Feed Error: API key not set in environment variables"
		);

		sys.exit(1);
	}
	else
	{
		console.log("🔵 [websocket-stock-feed] Polygon Websocket Stock Feed Running");

		// create a 15-min delay websocket client using the polygon client-js library
		const ws  = websocketClient(process.env.API__POLYGON__KEY, "wss://delayed.polygon.io").stocks();

		// register a handler to log errors
		ws.onerror = (err) =>
		{
			console.log("[websocket-stock-feed] Failed to connect", err);

			return;
		};

		// register a handler when messages are received
		ws.onmessage = async (msg) =>
		{
			// parse the data from the message
			const parsedMessage = JSON.parse(msg.data);

			// wait until the message saying authentication was successful, then subscribe to a channel
			if (parsedMessage[0].ev === "status" && parsedMessage[0].status === "auth_success")
			{
				console.log("[websocket-stock-feed] Subscribing to the minute aggregates channel for ALL stocks..");

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
				if (data.ev === "AM")
				{
					/**
					* Example fields
					{
						ev: "AM",
						sym: "AAPL",
						o: 123,
						c: 124,
						h: 125,
						l: 122,
						v: 1000,
						a: 123.5,
						s: 1620000000,
						e: 1620000060
					}
					*/
					if (BLACK_LISTED_SYMBOLS.has(data.sym))
					{
						continue;
					}

					try
					{
						await mySQLPool.promise().query(
							`
								INSERT INTO
									stock_1m_candle (symbol, open, close, high, low, volume, start, end)
								VALUES
									(?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?), FROM_UNIXTIME(?))
								;
							`,
							[
								data.sym,
								data.o,
								data.c,
								data.h,
								data.l,
								data.v,
								Math.floor(data.s / 1000),
								Math.floor(data.e / 1000)
							]
						);

						await mySQLPool.promise().query(
						`
							DELETE FROM
								stock_1m_candle
							WHERE
								symbol = ?
							AND id NOT IN (
								SELECT id FROM (
									SELECT
										id
									FROM
										stock_1m_candle
									WHERE
										symbol = ?
									ORDER BY
										start
									DESC
									LIMIT ?
								) AS recent
							);
						`,
						[data.sym, data.sym, 30]
						);
					}
					catch (err)
					{
						console.error("[websocket-stock-feed] DB insert error:", err);
					}
				}
			}
		};

		// register a handler to log info if websocket closes
		ws.onclose = (code, reason) =>
		{
			console.log("[websocket-stock-feed] Polygon Websocket Stock Feed Connection closed", code, reason);

			// Close SQL pool
			mySQLPool.end((err) =>
			{
				if (err)
				{
					console.error("[websocket-stock-feed] Error closing MySQL pool:", err);
				}
				else
				{
					console.log("[websocket-stock-feed] MySQL pool closed successfully.");
				}
			});
		};
	}
};
