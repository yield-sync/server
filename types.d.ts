import { FieldPacket, RowDataPacket, QueryResult } from "mysql2";


declare global
{
	// Wrappers
	type FieldPacket = FieldPacket;
	type QueryResult = QueryResult;

	// Types
	type UserCreate = {
		email: string,
		password: string,
	};

	type UserLogin = {
		email: string,
		password: string,
	};

	type UserPasswordUpdate = {
		email: string,
		password: string,
		passwordNew: string,
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
