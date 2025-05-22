import globals from "globals"

const rules = {
	"require-await": "warn",
	"comma-style": [1, "last"],
	curly: [1, "multi-line"],
	"eol-last": [1, "always"],
	eqeqeq: [1, "allow-null"],
	"func-call-spacing": 1,
	"no-unused-vars": 1,
	indent: ["warn", "tab"],
	"no-cond-assign": [1, "always"],
	"no-return-assign": [1, "always"],
	"no-shadow": ["error", {
		builtinGlobals: false,
		hoist: "functions",
		allow: [],
		ignoreOnInitialization: true,
	}],
	"no-var": 1,
	"object-curly-spacing": [1, "always"],
	"one-var": [1, "never"],
	"prefer-const": 2,
	quotes: [1, "double", {
		allowTemplateLiterals: true,
		avoidEscape: true,
	}],
	"semi-style": ["error", "first"],
	semi: [1, "never"],
}

export default [
	{
		ignores: ["dist/*"],
	},
	{
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: "module",
			globals: {
				...globals.browser
			}
		},
		rules
	}, 
	{
		files: ["**/*.test.js", "test/**/*.js", "rollup.userscript.config.js"],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: "module",
			globals: {
				...globals.browser,
				...globals.node
			}
		},
		rules
	}
]
