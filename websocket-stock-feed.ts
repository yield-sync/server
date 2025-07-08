/**
* @dev This script sets up a WebSocket client to connect to the Polygon.io delayed stock feed.
*/
import { websocketClient } from "@polygon.io/client-js";
import { sys } from "typescript";

require("dotenv").config();


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
	console.log("🟢 Polygon Websocket Stock Feed Running");

	// create a 15-min delay websocket client using the polygon client-js library
	const ws  = websocketClient(process.env.API__POLYGON__KEY, "wss://delayed.polygon.io").stocks();

	// register a handler to log errors
	ws.onerror = (err) =>
	{
		return console.log("Failed to connect", err);
	};

	// register a handler to log info if websocket closes
	ws.onclose = (code, reason) =>
	{
		return console.log("Connection closed", code, reason);
	};

	// register a handler when messages are received
	ws.onmessage = (msg) =>
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

		console.log("Message received:", parsedMessage);
	};
}
