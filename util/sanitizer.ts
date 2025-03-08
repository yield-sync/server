/**
 * Sanitizes a string for CoinGecko API queries.
 * @param input - The input to sanitize
 * @returns A trimmed, uppercase string with only alphanumeric characters and periods
 * @throws {TypeError} If input is not a string
 */
export function sanitizeQuery(input: unknown): string
{
	if (typeof input !== "string") {
		throw new TypeError("Input must be a string");
	}

	const trimmed = input.trim();
	if (!trimmed) return "";

	// Remove all except alphanumeric and periods
	return trimmed.replace(/[^a-zA-Z0-9.]/g, "")
}
