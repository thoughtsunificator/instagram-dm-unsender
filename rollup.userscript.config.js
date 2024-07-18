/** Bundle our main script into a valid userscript */

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
