import { execSync } from "child_process";
import path from "path";

import { dBBuilderProduction } from "./sql/db-builder";

async function main(overwrite)
{
	console.log("[info] Initializing server..");

	await dBBuilderProduction(overwrite);


	console.log("[info] Initializing frontend submodule..");

	const pathFrontendSubmodule = path.resolve(__dirname, "..");

	try
	{
		//execSync("git submodule update --init --recursive --remote --merge", {
		//	cwd: pathFrontendSubmodule,
		//	stdio: "inherit",
		//});

		//execSync(`npm install && npm run build`, {
		//	cwd: path.resolve(pathFrontendSubmodule, "frontend"),
		//	stdio: "inherit",
		//});
	}
	catch (err)
	{
		console.error("Failed to update submodule:", err);
	}
}

if (require.main === module)
{
	console.log("[info] Initializing server..");

	main(process.argv.includes("--overwrite") ? true : false);
}
