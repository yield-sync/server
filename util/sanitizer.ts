/**
* Sanitizes a string for CoinGecko API queries.
* @param input {unknown} The input to sanitize
* @returns A trimmed, uppercase string with only alphanumeric characters and periods
* @throws {TypeError} If input is not a string
*/
export function sanitizeQuery(input: unknown): string
{
	if (typeof input !== "string")
	{
		throw new TypeError("Input must be a string");
	}

	const trimmed = input.trim();
	if (!trimmed)
	{
		return "";
	}

	// Remove all except alphanumeric and periods
	return trimmed.replace(/[^a-zA-Z0-9.]/g, "");
}

/**
* Sanitize symbol query for stocks
* @param input {unknown} the input to santize
* @returns A trimmed, uppercase string with only alphanumeric characters and periods
* @throws {TypeError} If input is not a string
*/
export function sanitizeSymbolQuery(input: unknown): string
{
	if (typeof input !== "string")
	{
		throw new TypeError("Input must be a string");
	}

	const trimmed = input.trim();

	if (!trimmed)
	{
		return "";
	};

	// Remove all except letters and trim to 6 characters
	return trimmed.replace(/[^a-zA-Z]/g, "").substring(0, 6).toUpperCase();
}

export default {
	/**
	* @notice Sanitize an email
	* @param input {unknown} The input to sanitize
	* @returns A trimmed, uppercase string with only alphanumeric characters and periods
	* @throws {TypeError} If input is not a string
	*/
	sanitizeEmail: (input: unknown): string =>
	{
		if (typeof input !== "string")
		{
			throw new TypeError("Input must be a string");
		}

		// Trim whitespace and convert to lowercase
		const trimmed = input.trim().toLowerCase();

		// Validate the email format
		const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
		if (!emailRegex.test(trimmed))
		{
			throw new Error("Invalid email format");
		}

		return trimmed;
	},
	sanitizeQuery,
	sanitizeSymbolQuery,
	sanitizePin: (input: unknown): string =>
	{
		if (typeof input !== "string")
		{
			throw new TypeError("Input must be a string");
		}

		const trimmed = input.trim();

		if (!trimmed)
		{
			throw new Error("Input must be a non-empty string");
		}

		// Keep only letters (A-Z, a-z) and numbers (0-9)
		const sanitized = trimmed.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

		if (sanitized.length !== 6)
		{
			throw new Error("PIN must be exactly 6 alphanumeric characters");
		}

		return sanitized;
	},
};
