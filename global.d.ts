import { FieldPacket, OkPacket, RowDataPacket } from "mysql2";


declare global
{
	const ONE_WEEK_IN_MINUTES: number = 10080;
	const ONE_WEEK_IN_MS: number = ONE_WEEK_IN_MINUTES * 60 * 100

	// Wrappers
	type FieldPacket = FieldPacket;
	type RowDataPacket = RowDataPacket;

	// Types
	type Load = object;

	type MySQLQueryResult = [QueryResult, FieldPacket[]];

	// Interfaces
	interface ICryptocurrency extends
		RowDataPacket,
		OkPacket
	{
		id: string;
		name: string;
		symbol: string;
		sector: string;
		industry: string;
	}

	interface IPortfolio extends
		RowDataPacket,
		OkPacket
	{
		id: number;
		user_id: number;
		name: string;
		create: number;
	}

	interface IPortfolioAsset extends
		RowDataPacket,
		OkPacket
	{
		id: number;
		portfolio_id: number;
		cryptocurrency_id: number;
		stock_isin: string;
		percent_allocation: number;
		created: number;
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

	interface IRecovery extends
		RowDataPacket,
		OkPacket
	{
		id: number;
		user_id: number;
		attempts: number;
		name: string;
		pin: string;
		created: Date;
	}

	interface IStock extends
		RowDataPacket,
		OkPacket
	{
		isin: string;
		symbol: string;

		exchange: string;

		industry: string;
		name: string;
		sector: string;

		address: string;
		ceo: string;
		city: string;
		country: string;
		description: string;
		fullTimeEmployees: string;
		ipoDate: string;
		isEtf: string;
		phone: string;
		price_on_refresh: number;
		state: string;
		website: string;
		zip: string;

		description: string;

		refreshed_on: string;
	}

	// Interfaces
	interface IQueryCryptocurrency extends
		RowDataPacket,
		OkPacket
	{
		id: number;
		query: string;
		last_updated: Date;
	}

	interface IVerification extends
		RowDataPacket,
		OkPacket
	{
		id: number;
		user_id: number;
		attempts: number;
		name: string;
		pin: string;
		created: Date;
	}


	declare namespace Express {
		export interface Request {
			userDecoded?: {
				id: number;
				email: string;
				admin: Buffer;
				verified: Buffer;
				[key: string]: any;
			};
		}
	}
}
