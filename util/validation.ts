export const validateEmail = (email: string) =>
{
	return String(email).toLowerCase().match(
		/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
	);
};

export const validatePassword = (password: string) =>
{
	return (
		/^[\x00-\x7F]*$/.test(password) &&
        /[`!@#$%^&*()_\-+=\[\]{};':"\\|,.<>\/?~ ]/.test(password) &&
        password.length > 8 &&
        password.length < 500
	);
};
