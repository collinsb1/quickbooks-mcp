/**
 * Generate a compact line-item summary for transaction query results.
 * Returns null for non-transaction entities (Customer, Vendor, Account, etc.)
 */
export declare function summarizeTransactionLines(entity: string, entities: Array<Record<string, unknown>>): string | null;
//# sourceMappingURL=transaction-summary.d.ts.map