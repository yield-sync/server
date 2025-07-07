import { websocketClient } from "@polygon.io/client-js";

require("dotenv").config();

/**
* @dev Start the stock price feed
* This will connect to the Polygon WebSocket API and start receiving stock price updates
* The stock price feed will run in the background and update the stock prices in the database
* It will also log the stock price updates to the console
* This is useful for real-time stock price updates in the application
* If you want to disable the stock price feed, you can comment out the line below
* or set the environment variable `DISABLE_STOCK_PRICE_FEED` to `true`
*/

if (process.env.API__POLYGON__ENABLE_WEBSOCKET_STOCK_FEED == "true")
{
	/**
	 * @dev
	 * This example uses polygon client-js library to connect to the  delayed stocks polygon websocket to subscribe to
	 * minute ohlc values for the ticker AAPL.
	*/

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
			console.log("Subscribing to the minute aggregates channel for ticker AAPL..");

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
else
{
	console.log("🔴 Polygon Websocket Stock Feed Disabled");
}
