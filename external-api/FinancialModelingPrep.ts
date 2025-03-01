import axios from "axios";

import config from "../config";


const { uRL, key, } = config.api.financialModelingPrep;


export class NothingFoundError extends Error
{}

export class ExternalRequestError extends Error
{}


export const queryStock = async (ticker: string): Promise<IStock> => 
{
	try
	{
		const response = await axios.get(
			`${uRL}/api/v3/profile/${ticker}?apikey=${key}`
		);

		if (response.data.length == 0)
		{
			throw new NothingFoundError("Nothing found from external API");
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
};
