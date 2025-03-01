module.exports = {
	root: true,
	env: {
		node: true
	},
	parser: "@typescript-eslint/parser",
	plugins: [
		"@typescript-eslint"
	],
	parserOptions: {
		ecmaVersion: 2020
	},
	rules: {
		"array-bracket-newline": [
			"warn",
			"always",
		],
		"array-element-newline": [
			"warn",
			"always",
		],
		"array-bracket-spacing": [
			"warn",
			"never",
		],
		"arrow-body-style": [
			"warn",
			"always",
		],
		"arrow-parens": [
			"warn",
			"always",
		],
		"brace-style": [
			"warn",
			"allman",
		],
		"camelcase": [
			"warn",
			{
				"properties": "always" 
			},
		],
		"comma-dangle": [
			"warn",
			{
				"arrays": "always",
				"objects": "always",
				"imports": "never",
				"exports": "never",
				"functions": "never"
			},
		],
		"comma-spacing": [
			"warn",
			{
				"before": false,
				"after": true 
			},
		],
		"dot-location": [
			"warn",
			"property",
		],
		"indent": [
			"warn",
			"tab",
		],
		"implicit-arrow-linebreak": [
			"warn",
			"beside",
		],
		"jsx-quotes": [
			"warn",
			"prefer-double",
		],
		"key-spacing": [
			"warn",
			{
				"afterColon": true,
				"beforeColon": false 
			},
		],
		"keyword-spacing": [
			"warn",
			{
				"before": true 
			},
		],
		"lines-between-class-members": [
			"warn",
			"always",
		],
		"line-comment-position": [
			"warn",
			{
				"position": "above" 
			},
		],
		"no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
		"no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
		"no-duplicate-imports": "warn",
		"no-mixed-spaces-and-tabs": process.env.NODE_ENV === "production" ? "warn" : "off",
		"no-trailing-spaces": process.env.NODE_ENV === "production" ? "error" : "off",
		"object-curly-newline": [
			"warn",
			{
				"ObjectExpression": "always",
				"ImportDeclaration": "never",
				"ExportDeclaration": {
					"multiline": true, "minProperties": 3 
				}
			},
		],
		"quotes": [
			"warn",
			"double",
		],
		semi: [
			"warn",
			"always",
		],
		"@typescript-eslint/ban-types": [
			"warn"
		],
		"@typescript-eslint/no-inferrable-types": "off",
		"@typescript-eslint/no-empty-function": [
			"warn",
		]
	},
	overrides: [
		{
			"files": [
				"**/__tests__/*.{j,t}s?(x)",
				"**/tests/unit/**/*.spec.{j,t}s?(x)"
			],
			"env": {
			},
			"rules": {
				"indent": "off"
			}
		},
	]
};
