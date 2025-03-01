import { FieldPacket, OkPacket, RowDataPacket } from "mysql2";


declare global
{
	// Wrappers
	type FieldPacket = FieldPacket;
	type RowDataPacket = RowDataPacket;

	// Types
	type Load = object;


	type CryptoCreate = Load & {
		address?: string;
		isin?: string;
		name?: string;
		nativeToken?: boolean;
		network: string;
		symbol?: string;
	};

	type CryptoUpdate = Load & {
		address?: string;
		isin?: string;
		name?: string;
		nativeToken?: boolean;
		network?: string;
		symbol?: string;
	};

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
