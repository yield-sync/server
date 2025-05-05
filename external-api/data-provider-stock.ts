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
	getStockProfile: async (ticker: string): Promise<IStock | null> =>
	{
		try
		{
			const response = await axios.get(
				`${uRL}/stable/profile?symbol=${ticker}&apikey=${key}`
			);

			if (response.data.length == 0)
			{
				return null;
			}

			return {
				isin: response.data[0].isin,
				symbol: response.data[0].symbol,
				name: response.data[0].companyName,
				exchange: response.data[0].exchange.toLowerCase(),
				sector: response.data[0].sector,
				industry: response.data[0].industry,
			} as IStock;
		}
		catch (error)
		{
			throw new ExternalRequestError("Error fetching external API: " + error);
		}
	},

	queryForStock: async (ticker: string): Promise<any[]> =>
		{
			try
			{
				const response = await axios.get(
					`${uRL}/stable/search-symbol?query=${ticker}&apikey=${key}`
				);

				let stocks: any[] = [];

				for (let i = 0; i < response.data.length; i++)
				{
					stocks.push(
						{
							name: response.data[i].name,
							symbol: response.data[i].symbol,
							exchange: response.data[i].exchange,
						} as any
					);
				}

				return stocks;
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
	},
};
