/**
 * Convert dollars to cents (integer).
 * Rounds to nearest cent to handle floating-point input.
 */
export declare function toCents(dollars: number): number;
/**
 * Convert cents back to dollars for display/API.
 */
export declare function toDollars(cents: number): number;
/**
 * Validate that a dollar amount has at most 2 decimal places.
 * Returns the amount in cents if valid, throws if invalid.
 *
 * @param dollars - The dollar amount to validate
 * @param fieldName - Optional field name for error messages
 * @returns The amount in cents (integer)
 * @throws Error if amount has more than 2 decimal places
 */
export declare function validateAmount(dollars: number, fieldName?: string): number;
/**
 * Sum an array of cent amounts (integer addition).
 * Guarantees exact precision unlike float addition.
 */
export declare function sumCents(amounts: number[]): number;
/**
 * Validate that debits equal credits exactly.
 * Throws if they don't match.
 *
 * @param debitsCents - Total debits in cents
 * @param creditsCents - Total credits in cents
 * @throws Error if debits don't equal credits
 */
export declare function validateBalance(debitsCents: number, creditsCents: number): void;
/**
 * Format cents as a dollar string for display.
 */
export declare function formatDollars(cents: number): string;
//# sourceMappingURL=money.d.ts.map