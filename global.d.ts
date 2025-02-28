import { FieldPacket, RowDataPacket, QueryResult } from "mysql2";


declare global
{
	// Wrappers
	type FieldPacket = FieldPacket;
	type QueryResult = QueryResult;

	// Types
	type Load = object;


	type CryptoCreate = Load & {
		address?: string;
		isin?: string;
		name?: string;
		native_token?: boolean;
		network: string;
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
		portfolio_id: string,
		stockId: string,
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
	interface IStock extends
		RowDataPacket
	{
		id: number;
		name: string;
		symbol: string;
		exchange: string;
		isin: string | null;
	}

	interface IUser extends
		RowDataPacket
	{
		id: number;
		email: string;
		password: string;
		admin: number;
		verified: number;
		created: Date;
	}
}
