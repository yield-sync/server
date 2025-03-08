type CoingeckoCoin = {
	id: string,
	name: string,
	symbol: string,
}


import axios from "axios";

import config from "../config";


const { uRL, key, } = config.api.coingecko;


export class NothingFoundError extends
	Error
{}

export class ExternalRequestError extends
	Error
{}


export const queryCryptocurrency = async (query: string): Promise<CoingeckoCoin[]> =>
{
	let matchingResults = [];

	try
	{
		const response = await axios.request({
			method: "GET",
			url: `${uRL}/api/v3/coins/list`,
			headers: {
				accept: "application/json",
				"x-cg-demo-api-key": key,
			},
		});

		if (response.data.length == 0)
		{
			throw new NothingFoundError("Nothing found from external API");
		}


		for (let i = 0; i < response.data.length; i++) {
			const cryptocurrency = response.data[i];

			if (cryptocurrency.symbol == query.toLowerCase())
			{
				matchingResults.push(cryptocurrency);
			}
		}

		return matchingResults;
	}
	catch (error)
	{
		throw new ExternalRequestError("Error fetching external API: " + error);
	}
};
