import axios from "axios";

import config from "../config";
import { sanitizeQuery } from "../util/sanitizer";


const { uRL, key, } = config.api.coingecko;

// Classes
class ExternalRequestError extends
	Error
{}

export default {
	queryForCryptocurrency: async (query: string): Promise<CoingeckoCoin[]> =>
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
	},

	getCryptocurrencyProfileById: async (id: string): Promise<ICryptocurrency> =>
	{
		try
		{
			const cleanedQuery: string = sanitizeQuery(id);

			const response = await axios.request({
				method: "GET",
				url: `${uRL}api/v3/coins/${cleanedQuery}`,
				headers: {
					accept: "application/json",
					"x-cg-demo-api-key": key,
				},
			});

			if (!response.data.id)
			{
				throw new ExternalRequestError("Response did not provide \"response.data.id\"");
			}

			if (!response.data.symbol)
			{
				throw new ExternalRequestError("Response did not provide \"response.data.symbol\"");
			}

			if (!response.data.name)
			{
				throw new ExternalRequestError("Response did not provide \"response.data.name\"");
			}

			return {
				id: response.data.id,
				symbol: response.data.symbol,
				name: response.data.name,
			} as ICryptocurrency
		}
		catch (error)
		{
			throw new ExternalRequestError("Error fetching external API: " + error);
		}
	},
};
