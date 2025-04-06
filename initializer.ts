class InitializerError extends
	Error
{}


import config from "./config";
import { dBBuilderProduction } from "./sql/db-builder";


async function main(overwrite: boolean)
{
	if (
		!config.api.coingecko.key ||
		!config.api.coingecko.uRL
	)
	{
		throw new InitializerError("Missing api.coingecko values");
	}

	if (
		!config.api.financialModelingPrep.uRL ||
		!config.api.financialModelingPrep.key
	)
	{
		throw new InitializerError("Missing api.financialModelingPrep values");
	}

	if (
		!config.app.database.host ||
		!config.app.database.name ||
		!config.app.database.password ||
		!config.port ||
		!config.app.database.user
	)
	{
		throw new InitializerError("Missing SQL database connection values");
	}

	await dBBuilderProduction(overwrite);
}

if (require.main === module)
{
	try
	{
		main(process.argv.includes("--overwrite") ? true : false);
	}
	catch (e)
	{
		console.error(e);
		process.exit(1);
	}
}
