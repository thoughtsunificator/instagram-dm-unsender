/**
 * Bundle our main script into a valid userscript.
 *
 * Userscript that can be fed to most if not all userscript managers.
 *
 * What does it do?
 *
 * 1. Reads the userscript metadata in data/meta.json
 *	1.1 Build the userscript metadata section
 * 2. Load node_modules using rollup's own plugin (node-resolve)
 * 3. Bundled by rollup
 *
 * Note: When developing (env.BUILD != production) the userscript
 * will be served via an HTTP server under process.env.PORT || 3000
 */

import fs from "fs"
import nodeResolve from "@rollup/plugin-node-resolve"
import serve from "rollup-plugin-serve"

const isProduction = process.env.BUILD === "production"
const isDevelopment = !isProduction

export default {
	input: "./src/runtime/userscript/main.js",
	output: {
		file: "./dist/idmu.user.js",
		format: "iife",
		sourcemap: "inline"
	},
	plugins: [
		{
			buildStart(){
				this.addWatchFile("./data/meta.json")
			},
			banner: () => {
				const metadata = JSON.parse(fs.readFileSync("./data/meta.json"))
				metadata.version = JSON.parse(fs.readFileSync("./package.json")).version
				let str = "// ==UserScript==\n"
				for(const property in metadata) {
					str += `\n// @${property}\t\t\t\t${metadata[property]}`
				}
				str += "\n\n// ==/UserScript==\n\n"
				return str
			}
		},
		nodeResolve(),
		isDevelopment && serve({
			contentBase: "dist",
			port: process.env.PORT || 3000
		}),
	]
}
