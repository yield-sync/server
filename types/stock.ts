

type StockCreate = Load & {
	exchange: string;
	isin: string;
	name?: string;
	symbol?: string;
};

type StockSearchQuery = {
	refreshed: boolean,
	stock: IStock,
	dBStockWithExSymbolFound: boolean,
}

type StockDelete = Load & {
	stock_isin: string,
}
