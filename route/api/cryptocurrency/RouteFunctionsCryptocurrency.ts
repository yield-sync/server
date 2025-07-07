import mysql from "mysql2";

import extAPIDataProviderCryptocurrency from "../../../external-api/data-provider-cryptocurrency";
import DBHandlerCryptocurrency from "../../../db-handler/DBHandlerCryptocurrency";
import DBHandlerQueryCryptocurrency from "../../../db-handler/DBHandlerQueryCryptocurrency";


const ONE_WEEK_IN_MINUTES: number = 10080;
const ONE_WEEK_IN_MS: number = ONE_WEEK_IN_MINUTES * 60 * 100;


export default class RouteFunctionsCryptocurrency
{
	private _dBHandlerCryptocurrency: DBHandlerCryptocurrency;

	private _dBHandlerQueryCryptocurrency: DBHandlerQueryCryptocurrency;

	public ERROR_STOCK_PROFILE_EXTERNALLY_NOT_FOUND: string = "⚠️ Nothing returned from external source for symbol";


	constructor(mySQLPool: mysql.Pool)
	{
		this._dBHandlerCryptocurrency = new DBHandlerCryptocurrency(mySQLPool);
		this._dBHandlerQueryCryptocurrency = new DBHandlerQueryCryptocurrency(mySQLPool);
	}


	private async _getCryptocurrencyLikeQuery(query: string)
	{
		// Get from external source the crypto that fit the query
		const cryptoResults: CoingeckoCoin[] = await extAPIDataProviderCryptocurrency.queryForCryptocurrency(query);

		// Add it to the database if it doesnt exist already
		for (let i: number = 0; i < cryptoResults.length; i++)
		{
			let cryptocurrencyWithId = await this._dBHandlerCryptocurrency.getCryptocurrencyById(cryptoResults[i].id);

			if (cryptocurrencyWithId.length == 0)
			{
				await this._dBHandlerCryptocurrency.createCryptocurrency(
					{
						id: cryptoResults[i].id,
						name: cryptoResults[i].name,
						symbol: cryptoResults[i].symbol,
						sector: "Decentralized Protocol",
						industry: "Decentralized Protocol",
					} as ICryptocurrency
				);
			}
		}
	}


	public createNewAssetById = async (id: string): Promise<ICryptocurrency> =>
	{
		const dBAsset: ICryptocurrency[] = await this._dBHandlerCryptocurrency.getCryptocurrencyById(id);

		if (dBAsset.length > 0)
		{
			throw new Error("Cryptocurrency already exists");
		}

		const externalCryptocurrency: ICryptocurrency = await extAPIDataProviderCryptocurrency.getCryptocurrencyProfileById(id);

		if (!externalCryptocurrency)
		{
			throw new Error(this.ERROR_STOCK_PROFILE_EXTERNALLY_NOT_FOUND);
		}

		await this._dBHandlerCryptocurrency.createCryptocurrency(externalCryptocurrency);

		return externalCryptocurrency;
	};

	public readCryptocurrencyById = async (id: string): Promise<ICryptocurrency> =>
	{
		const dBAsset: ICryptocurrency[] = await this._dBHandlerCryptocurrency.getCryptocurrencyById(id);

		if (dBAsset.length == 0)
		{
			throw new Error("Cryptocurrency not found");
		}

		return dBAsset[0];
	};

	public searchCryptocurrencyByLikeSymbol = async (query: string, utilizeExternalSource: boolean = false): Promise<{
		updatedDB: boolean,
		results: ICryptocurrency[]
	}> =>
	{
		let updateDBRequired: boolean = false;

		if (utilizeExternalSource)
		{
			const now: number = (new Date()).getTime();

			const queryCrypto: IQueryCryptocurrency[] = await this._dBHandlerQueryCryptocurrency.getByQuery(query);

			if (queryCrypto.length > 0)
			{
				const lastRefresh: number = (new Date(queryCrypto[0].last_updated)).getTime();

				const updatedOverAWeekAgo: boolean = now - lastRefresh >= ONE_WEEK_IN_MS;

				if (updatedOverAWeekAgo)
				{
					updateDBRequired = true;
				}
			}
			else
			{
				await this._dBHandlerQueryCryptocurrency.create(query);

				updateDBRequired = true;
			}

			if (updateDBRequired)
			{
				await this._getCryptocurrencyLikeQuery(query);

				await this._dBHandlerQueryCryptocurrency.updatedNow(query);
			}
		}

		return {
			updatedDB: updateDBRequired,
			results: await this._dBHandlerCryptocurrency.getCryptocurrencyByLikeSymbol(query),
		};
	};
}

