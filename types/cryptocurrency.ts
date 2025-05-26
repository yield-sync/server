type CryptocurrencyCreate = Load & {
	id: string;
	name: string;
	symbol: string;
};

type CryptocurrencyUpdate = Load & {
	name?: string;
	symbol?: string;
};

type CoingeckoCoin = {
	id: string,
	name: string,
	symbol: string,
	api_symbol: string,
	market_cap_rank: number,
	thumb: string,
	large: string,
}
