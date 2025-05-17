

type StockCreate = Load & {
	exchange: string;
	isin: string;
	name?: string;
	symbol?: string;
};

type StockSearchQuery = {
	UpdateStockPerformed: boolean,
	stock: IStock,
	dBStockWithExSymbolFound: boolean,
}

type StockDelete = Load & {
	stock_isin: string,
}
