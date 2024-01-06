
import fs from "fs"
import nodeResolve from "@rollup/plugin-node-resolve"
import pkg from "./package.json" assert { type: "json" }

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
			banner: async () => {
				const metadata = JSON.parse(fs.readFileSync("./data/meta.json"))
				metadata.version = pkg.version
				let str = "// ==UserScript==\n"
				for(const property in metadata) {
					str += `\n// @${property}\t\t\t\t${metadata[property]}`
				}
				str += "\n\n// ==/UserScript==\n\n"
				return str
			}
		},
		nodeResolve(),
	]
}
