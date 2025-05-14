import axios from "axios";

import config from "../config";


const { uRL, key, } = config.api.financialModelingPrep;


export class NothingFoundError extends
	Error
{}

export class ExternalRequestError extends
	Error
{}


const _getStockTickerFromIsin = async (isin: string): Promise<string|null> => 
{
	// First get the symbol by the isin
	const openfigiResponse = await axios.post(
		"https://api.openfigi.com/v3/mapping",
		[
			{
				"idType": "ID_ISIN",
				"idValue": isin,
				"exchCode": "US",
			},
		],
		{
			headers: {
				"Content-Type": "application/json",
				"X-OPENFIGI-APIKEY": config.api.openfigi.key,
			},
		}
	);

	if ("error" in openfigiResponse.data)
	{
		return null;
	}

	if (!("ticker" in openfigiResponse.data))
	{
		return null;
	}

	return openfigiResponse.data.ticker;
};


export default {
	getStockProfileByIsin: async (isin: string): Promise<IStock | null> =>
	{
		try
		{
			const symbol = await _getStockTickerFromIsin(isin);

			if (!symbol) return null;

			const response = await axios.get(
				`${uRL}/stable/profile?symbol=${symbol}&apikey=${key}`
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
			console.warn("Error fetching external API: " + error);

			return null;
		}
	},

	getStockProfileBySymbol: async (symbol: string): Promise<IStock | null> =>
	{
		try
		{
			const response = await axios.get(
				`${uRL}/stable/profile?symbol=${symbol}&apikey=${key}`
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
			console.warn("Error fetching external API: " + error);

			return null;
		}
	},

	queryForStockBySymbol: async (symbol: string): Promise<any[]> =>
	{
		try
		{
			const response = await axios.get(
				`${uRL}/stable/search-symbol?query=${symbol}&apikey=${key}`
			);

			let stocks: any[] = [
			];

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
				`${uRL}/api/v3/read/${response.data[0].symbol}?apikey=${key}`
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
