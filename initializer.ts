import { exec } from "child_process";
import path from "path";

import { dBBuilderProduction } from "./sql/db-builder";


if (require.main === module)
{
	console.log("[info] Initializing server..");

	dBBuilderProduction(process.argv.includes("--overwrite") ? true : false);


	console.log("[info] Initializing frontend submodule..");

	const pathFrontendSubmodule = path.resolve(__dirname, "..", "frontend");

	const command_git_submodule = "git submodule update --init --recursive --remote --merge";
	const command_npm_install = `npm install --prefix ${pathFrontendSubmodule}`;
	const command_npm_run_build = `npm run build --prefix ${pathFrontendSubmodule}`;

	exec(`${command_git_submodule} && ${command_npm_install} && ${command_npm_run_build}`, (error, stdout, stderr) =>
	{
		if (error)
		{
			console.error(`exec error: ${error}`);
			return;
		}

		if (stderr)
		{
			console.error(`stderr: ${stderr}`);
		}

		console.log(`stdout: ${stdout}`);
	});
}
