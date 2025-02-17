export type UserCreate = {
	email: string,
	password: string,
};

export type UserLogin = {
	email: string,
	password: string,
};

export type UserPasswordUpdate = {
	email: string,
	password: string,
	passwordNew: string,
};
