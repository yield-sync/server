import axios from "axios";

import config from "../config";


const { uRL, key, } = config.api.coingecko;


export class NothingFoundError extends
	Error
{}

export class ExternalRequestError extends
	Error
{}


export const queryCryptocurrency = async (symbol: string): Promise<any> =>
{
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

		console.log(response);

		if (response.data.length == 0)
		{
			throw new NothingFoundError("Nothing found from external API");
		}

		return;
	}
	catch (error)
	{
		throw new ExternalRequestError("Error fetching external API: " + error);
	}
};
