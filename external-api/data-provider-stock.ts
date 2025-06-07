import axios from "axios";

import config from "../config";


const { uRL, key, } = config.api.financialModelingPrep;


// Classes
class ExternalRequestError extends
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

	if (openfigiResponse.status != 200)
	{
		return null;
	}

	if (openfigiResponse?.data[0]?.warning)
	{
		return null
	}

	if (!("ticker" in openfigiResponse.data[0].data[0]))
	{
		return null;
	}

	return openfigiResponse.data[0].data[0].ticker;
};


export default {
	getStockProfileByIsin: async (isin: string): Promise<IStock | null> =>
	{
		try
		{
			const symbol = await _getStockTickerFromIsin(isin);

			if (!symbol) throw new Error("Invalid ISIN passed");

			const response = await axios.get(
				`${uRL}/stable/profile?symbol=${symbol}&apikey=${key}`
			);

			if (response.data.length == 0)
			{
				throw new Error("Nothing found from external source");
			}

			return {
				isin: response.data[0].isin,
				symbol: response.data[0].symbol,

				exchange: response.data[0].exchange.toLowerCase(),

				industry: response.data[0].industry,
				name: response.data[0].companyName,
				sector: response.data[0].sector,

				address: response.data[0].address,
				ceo: response.data[0].ceo,
				city: response.data[0].city,
				country: response.data[0].country,
				description: response.data[0].description,
				fullTimeEmployees: response.data[0].fullTimeEmployees,
				ipoDate: response.data[0].ipoDate,
				isEtf: response.data[0].isEtf,
				phone: response.data[0].phone,
				price_on_refresh: response.data[0].price,
				state: response.data[0].state,
				website: response.data[0].website,
				zip: response.data[0].zip,
			} as IStock;
		}
		catch (error)
		{
			throw new ExternalRequestError("[getStockProfileByIsin] Error fetching from external API: " + error);
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
				exchange: response.data[0].exchange.toLowerCase(),
				industry: response.data[0].industry,
				name: response.data[0].companyName,
				sector: response.data[0].sector,
				address: response.data[0].address,
				ceo: response.data[0].ceo,
				city: response.data[0].city,
				country: response.data[0].country,
				description: response.data[0].description,
				fullTimeEmployees: response.data[0].fullTimeEmployees,
				ipoDate: response.data[0].ipoDate,
				isEtf: response.data[0].isEtf,
				phone: response.data[0].phone,
				price_on_refresh: response.data[0].price,
				state: response.data[0].state,
				website: response.data[0].website,
				zip: response.data[0].zip,
			} as IStock;
		}
		catch (error)
		{
			throw new ExternalRequestError("[getStockProfileBySymbol] Error fetching from external API: " + error);
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
			throw new ExternalRequestError("[queryForStockBySymbol] Error fetching from external API: " + error);
		}
	},
};
