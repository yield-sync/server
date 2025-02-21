import mysql from "mysql2";


// types.d.ts
declare global {
	type MySQLQueryResult = [mysql.QueryResult, mysql.FieldPacket[]];
}


export {};
