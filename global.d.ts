import { FieldPacket, OkPacket, RowDataPacket } from "mysql2";


declare global
{
	// Wrappers
	type FieldPacket = FieldPacket;
	type RowDataPacket = RowDataPacket;

	// Types
	type Load = object;


	type CryptocurrencyCreate = Load & {
		coingecko_id: string;
		name?: string;
		symbol?: string;
	};

	type CryptocurrencyUpdate = Load & {
		coingecko_id: string;
		name?: string;
		symbol?: string;
	};

	type CoingeckoCoin = {
		id: string,
		name: string,
		symbol: string,
		api_symbol: string,
		market_cap_rank: number,
		thumb: string,
		large: string,
	}

	type StockCreate = Load & {
		exchange: string;
		isin: string;
		name?: string;
		symbol?: string;
	};

	type StockUpdate = Load & {
		stockId: string;
		exchange: string;
		isin: string;
		name?: string;
		symbol?: string;
	};

	type StockDelete = Load & {
		stockId: string,
	};

	type PortfolioAssetCreate = Load & {
		portfolioId: string,
		stockId: string,
	};

	type PortfolioAssetCreateByQuery = Load & {
		portfolioId: string,
		query: string,
		crypto?: boolean;
	};

	type PortfolioCreate = Load & {
		name: string,
	};

	type PortfolioUpdate = Load & {
		id: string,
		name: string,
	};

	type UserCreate = Load & {
		email: string,
		password: string,
	};

	type UserLogin = Load & {
		email: string,
		password: string,
	};

	type UserPasswordUpdate = Load & {
		email: string,
		password: string,
		passwordNew: string,
	};

	type UserVerify = Load & {
		email: string,
		pin: string,
	};

	type MySQLQueryResult = [QueryResult, FieldPacket[]];

	// Interfaces
	interface ICrypto extends
		RowDataPacket,
		OkPacket
	{
		id: number;
		name: string;
		symbol: string;
		network: string;
		isin?: string;
	}

	interface ICryptocurrency extends
		RowDataPacket,
		OkPacket
	{
		id: number;
		coingecko_id: string;
		name: string;
		symbol: string;
	}

	interface IPortfolio extends
		RowDataPacket,
		OkPacket
	{
		id: number;
		name: string;
	}

	interface IPortfolioAsset extends
		RowDataPacket,
		OkPacket
	{
		id: number;
		portfolioId: number;
		stockId: number;
		created: number;
	}

	interface IStock extends
		RowDataPacket,
		OkPacket
	{
		id: number;
		name: string;
		symbol: string;
		exchange: string;
		isin: string;
	}

	interface IUser extends
		RowDataPacket,
		OkPacket
	{
		id: number;
		email: string;
		password: string;
		admin: number;
		verified: number;
		created: Date;
	}
}
