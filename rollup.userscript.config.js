
import fs from "fs"
import { terser } from "@wwa/rollup-plugin-terser"
import nodeResolve from "@rollup/plugin-node-resolve"
import rollupWindowEnv from "@thoughtsunificator/rollup-plugin-window-env"
const isProduction = process.env.BUILD === "production"
const isDevelopment = !isProduction


export default {
    input: "./src/userscript/userscript.js",
    output: {
        file: "./dist/bundle.js",
        format: "iife",
        sourcemap: isDevelopment
    },
    plugins: [
        {
            buildStart(){
                this.addWatchFile("./data/meta.json")
            },
            banner: async () => {
                const metadata = JSON.parse(fs.readFileSync("./data/meta.json"))
                let str = "// ==UserScript==\n"
                for(const property in metadata) {
                    str += `\n//@ ${property}\t\t\t\t${metadata[property]}`
                }
                str += "\n\n// ==UserScript==\n\n"
                return str
            }
        },
        rollupWindowEnv({ envPath : isDevelopment ? ".env.dev.json" : ".env.json", confPath : "data/config.json" }),
        isProduction && terser(),
        nodeResolve()
    ]
}