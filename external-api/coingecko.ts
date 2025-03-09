import axios from "axios";

import config from "../config";
import { sanitizeQuery } from "../util/sanitizer";


const { uRL, key, } = config.api.coingecko;


export class ExternalRequestError extends
	Error
{}


export const queryForCryptocurrency = async (query: string): Promise<CoingeckoCoin[]> =>
{
	try
	{
		const cleanedQuery: string = sanitizeQuery(query);

		const response = await axios.request({
			method: "GET",
			url: `${uRL}/api/v3/search?query=${cleanedQuery}`,
			headers: {
				accept: "application/json",
				"x-cg-demo-api-key": key,
			},
		});

		return response.data.coins;
	}
	catch (error)
	{
		throw new ExternalRequestError("Error fetching external API: " + error);
	}
};
