import { FieldPacket, RowDataPacket, QueryResult } from "mysql2";


declare global
{
	// Wrappers
	type FieldPacket = FieldPacket;
	type QueryResult = QueryResult;

	// Types
	type Load = object;

	type AssetCreate = Load & {
		native_token?: boolean;
		symbol?: string;
		name?: string;
		network: string;
		isin?: string;
		address?: string;
	};

	type AssetUpdate = Load & {
		assetId: string;
		symbol?: string;
		name?: string;
		network: string;
		isin?: string;
		address?: string;
	};

	type AssetDelete = Load & {
		assetId: string,
	};

	type PortfolioAssetCreate = Load & {
		portfolio_id: string,
		assetId: string,
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
	interface IAsset extends
		RowDataPacket
	{
		id: number;
		name: string;
		symbol: string;
		network: string;
		isin: string | null;
		address: string | null;
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
