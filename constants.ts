export const blockchainNetworks = [
	"arbitrum",
	"base",
	"ethereum",
	"op-mainnet",
	"solana",
];

export const stockMarkets = [
	"nasdaq",
	"nyse",
];

export const allNetworks = [
	...blockchainNetworks,
	...stockMarkets,
];

export const hTTPStatus = {
	OK: 200,
	CREATED: 201,
	ACCEPTED: 202,
	NO_CONTENT: 204,
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	METHOD_NOT_ALLOWED: 405,
	CONFLICT: 409,
	INTERNAL_SERVER_ERROR: 500,
	BAD_GATEWAY: 502,
	SERVICE_UNAVAILABLE: 503,
	GATEWAY_TIMEOUT: 504,
} as const;
