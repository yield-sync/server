import { dBBuilderProduction } from "./sql/db-builder";

async function main(overwrite)
{
	await dBBuilderProduction(overwrite);
}

if (require.main === module)
{
	main(process.argv.includes("--overwrite") ? true : false);
}
