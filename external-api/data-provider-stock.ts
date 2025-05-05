import axios from "axios";

import config from "../config";
import DBHandlerPlatform from "../db-handler/platform";


const { uRL, key, } = config.api.financialModelingPrep;


export class NothingFoundError extends
	Error
{}

export class ExternalRequestError extends
	Error
{}


export default {
	getStockProfile: async (id: string): Promise<IAsset | null> =>
	{
		try
		{
			// First get the symbol by the id
			const openfigiResponse = await axios.post(
				"https://api.openfigi.com/v3/mapping",
				[
					{
						"idType": "ID_ISIN",
						"idValue": id,
						"exchCode": "US"
					}
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

			const symbol = openfigiResponse.data.ticker;

			const response = await axios.get(
				`${uRL}/stable/profile?symbol=${symbol}&apikey=${key}`
			);

			if (response.data.length == 0)
			{
				return null;
			}

			return {
				type: "stock",
				id: response.data[0].isin,
				symbol: response.data[0].symbol,
				name: response.data[0].companyName,
				platform: response.data[0].exchange.toLowerCase(),
				sector: response.data[0].sector,
				industry: response.data[0].industry,
			} as IAsset;
		}
		catch (error)
		{
			console.warn("Error fetching external API: " + error);

			return null;
		}
	},

	queryForStock: async (symbol: string): Promise<IAsset[]> =>
	{
		try
		{
			const response = await axios.get(
				`${uRL}/stable/search-symbol?query=${symbol}&apikey=${key}`
			);

			let stocks: any[] = [];

			for (let i = 0; i < response.data.length; i++)
			{
				stocks.push(
					{
						type: "stock",
						id: "",
						symbol: response.data[i].symbol,
						name: response.data[i].name,
						platform: response.data[i].exchange.toLowerCase(),
						sector: "",
						industry: "",
					} as IAsset
				);
			}

			return stocks;
		}
		catch (error)
		{
			throw new ExternalRequestError("Error fetching external API: " + error);
		}
	},

	queryForStockByIsin: async (isin: string): Promise<IAsset | null> =>
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
				type: "stock",
				id: response.data[0].isin,
				symbol: response.data[0].symbol,
				name: response.data[0].name,
				platform: response1.data[0].exchangeShortName.toLowerCase(),
			} as IAsset;
		}
		catch (error)
		{
			throw new ExternalRequestError("Error fetching external API: " + error);
		}
	},
};
