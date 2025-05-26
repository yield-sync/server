type PortfolioAssetCreate = Load & {
	portfolio_id: string,
	stock_isin?: string,
	cryptocurrency_id?: string,
	percent_allocation: number,
	balance: number;
};

type PortfolioAssetCreateByQuery = Load & {
	portfolio_id: string,
	query: string,
	crypto?: boolean;
};

type PortfolioAssetUpdate = Load & {
	id: string;
	balance: number;
	percent_allocation: number;
};
