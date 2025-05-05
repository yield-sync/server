import mysql from "mysql2";


export default {
	getPlatforms: async (mySQLPool: mysql.Pool): Promise<any[]> =>
	{
		let [
			platforms,
		] = await mySQLPool.promise().query<any[]>(
			"SELECT * FROM platform;",
			[
			]
		);

		return platforms;
	},
};
