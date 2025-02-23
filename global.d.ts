import { FieldPacket, RowDataPacket, QueryResult } from "mysql2";


declare global
{
	// Wrappers
	type FieldPacket = FieldPacket;
	type QueryResult = QueryResult;

	// Types
	type Load = {};

	type AssetCreate = Load & {
		symbol: string,
		name: string,
	};

	type AssetUpdate = Load & {
		asset_id: string,
		name: string,
		symbol: string,
	};

	type AssetDelete = Load & {
		asset_id: string,
	};

	type PortfolioAssetCreate = Load & {
		portfolio_id: string,
		asset_id: string,
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
	interface IUser extends
		RowDataPacket
	{
		id: number;
		email: string;
		password: string;
		admin: number;
		verified: number;
		created: Date;
		ssid: string;
	}
}
