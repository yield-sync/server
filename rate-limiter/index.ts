// [REQUIRE] Personal
import rateLimit, { RateLimitRequestHandler } from "express-rate-limit";


// [INIT] Const
const defaultMessage: string = "Too many requests, please try again later";

const TWO_HOURS_IN_MS = 2 * 60 * 60 * 1000;
const FIFTEEN_MINUTES_IN_MS = 15 * 60 * 1000;


export default {
	global: rateLimit({
		windowMs: FIFTEEN_MINUTES_IN_MS,
		max: 500,
		message: {
			executed: true,
			status: false,
			message: defaultMessage,
		},
	}) as RateLimitRequestHandler,

	emailRateLimiter: rateLimit({
		windowMs: TWO_HOURS_IN_MS,
		max: 5, // Limit each IP to 5 requests per windowMs
		message: "⏳ Too many requests, please try again in 2 hours",
		standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
		legacyHeaders: false,  // Disable the `X-RateLimit-*` headers
	}) as RateLimitRequestHandler,
};
