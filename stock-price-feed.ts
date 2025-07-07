import WebSocket from 'ws';


export default function stockPriceFeed()
{
	// stocks 15-min delay
	const ws = new WebSocket('wss://delayed.polygon.io/stocks');

	// Connection Opened
	ws.on('open', () => {
		console.log('Connected to Polygon.io web socket..');

		// Authenticate with API key
		ws.send(`{"action":"auth","params":"${process.env.API__POLYGON__KEY}"}`);

		// Aggregates data by min
		ws.send(`{"action":"subscribe","params":"AM.*"}`);

		// Aggregate data by sec
		// ws.send(`{"action":"subscribe","params":"A.*"}`);
	});

	// Per message packet:
	ws.on('message', ( data ) =>
	{
		data = JSON.parse( data )
		data.map(( msg ) =>
		{
			if (msg.ev === 'status')
			{
				return console.log('Status Update:', msg.message)
			}
			console.log(msg)
		});
	});

	ws.on('error', console.log);
}
