type UserCreate = Load & {
	email: string,
	password: string,
};

type UserLogin = Load & {
	email: string,
	password: string,
};

type UserPasswordUpdate = Load & {
	email: string,
	password: string,
	passwordNew: string,
};

type UserRecoverPassword = Load & {
	pin: string,
	passwordNew: string,
};

type UserSendRecoveryEmail = Load & {
	email: string,
};

type UserVerify = Load & {
	pin: string,
};
