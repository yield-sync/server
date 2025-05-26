type PortfolioCreate = Load & {
	name: string,
};

type PortfolioUpdate = Load & {
	id: string,
	name: string,
};
