import config from "./config";
import { dBBuilderProduction } from "./sql/db-builder";


require("dotenv").config();


class InitializerError extends
	Error
{}


async function main(overwrite: boolean)
{
	if (!process.env.NO_CACHE || process.env.NO_CACHE != "1")
	{
		console.warn("[warn] ENV NO_CACHE not set to 1");
	}

	if (!config.app.secretKey)
	{
		throw new InitializerError("Missing secret values");
	}

	if (!config.api.coingecko.key || !config.api.coingecko.uRL)
	{
		throw new InitializerError("Missing api.coingecko values");
	}

	if (!config.api.financialModelingPrep.uRL || !config.api.financialModelingPrep.key)
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

	if (process.env.SKIP_DB_BUILDER === "1")
	{
		console.warn("[warn] Skipping DB Builder");
		return;
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
