import axios from "axios";

import config from "../config";


const { uRL, key, } = config.api.financialModelingPrep;


export class NothingFoundError extends
	Error
{}

export class ExternalRequestError extends
	Error
{}


export default {
	queryForStock: async (ticker: string): Promise<IStock | null> =>
	{
		try
		{
			const response = await axios.get(
				`${uRL}/api/v3/profile/${ticker}?apikey=${key}`
			);

			if (response.data.length == 0)
			{
				return null;
			}

			return {
				symbol: response.data[0].symbol,
				name: response.data[0].companyName,
				exchange: response.data[0].exchangeShortName.toLowerCase(),
				isin: response.data[0].isin,
			} as IStock;
		}
		catch (error)
		{
			throw new ExternalRequestError("Error fetching external API: " + error);
		}
	},

	queryForStockByIsin: async (isin: string): Promise<IStock | null> =>
	{
		try
		{
			const response = await axios.get(
				`${uRL}/stable/search-isin?isin=${isin}&apikey=${key}`
			);

			if (response.data.length == 0)
			{
				return null;
			}

			const response1 = await axios.get(
				`${uRL}/api/v3/profile/${response.data[0].symbol}?apikey=${key}`
			);

			return {
				symbol: response.data[0].symbol,
				name: response.data[0].name,
				exchange: response1.data[0].exchangeShortName.toLowerCase(),
				isin: response.data[0].isin,
			} as IStock;
		}
		catch (error)
		{
			throw new ExternalRequestError("Error fetching external API: " + error);
		}
	}
}
