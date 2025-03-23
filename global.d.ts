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

	type StockSearchQuery = {
		refreshRequired: boolean,
		stocks: IStock[],
	}

	type StockDelete = Load & {
		stock_id: number,
	};

	type PortfolioAssetCreate = Load & {
		portfolio_id: string,
		stock_id: string,
		percent_allocation: number,
	};

	type PortfolioAssetCreateByQuery = Load & {
		portfolio_id: string,
		query: string,
		crypto?: boolean;
	};

	type PortfolioAssetUpdate = Load & {
		id: string;
		stock_id: string;
		portfolio_id: string;
		percent_allocation: number;
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

	type UserSendRecoveryEmail = Load & {
		email: string,
	};

	type UserVerify = Load & {
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
		portfolio_id: number;
		stock_id: number;
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
