import mysql from "mysql2";


export default class DBHandlerSector
{
	private mySQLPool: mysql.Pool;


	constructor(mySQLPool: mysql.Pool)
	{
		this.mySQLPool = mySQLPool;
	}

	/**
	* Retrieves all sectors from the database.
	* @returns {Promise<ISector[]>} A promise that resolves to an array of sectors.
	* @throws {Error} If the query fails or if the result is not an array.
	*/
	public async getSectors(): Promise<ISector[]>
	{
		let [
			sector,
		] = await this.mySQLPool.promise().query<ISector[]>(
			"SELECT * FROM sector;",
			[]
		);

		if (!Array.isArray(sector))
		{
			throw new Error("Expected result is not Array");
		}

		// If no sectors found, return an empty array
		if (sector.length === 0)
		{
			return [];
		}

		// Convert the result to Sector type if necessary
		return sector;
	};
}
