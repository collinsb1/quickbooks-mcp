import QuickBooks from "node-quickbooks";
import { PaginationParams, PaginatedQueryResult } from "../types/index.js";
export declare const BATCH_SIZE = 1000;
export declare const SAFETY_LIMIT = 10000;
export declare const WARNING_THRESHOLD = 5000;
export declare function parsePaginationFromQuery(query: string): PaginationParams;
export declare function paginatedQuery(client: QuickBooks, finderMethod: keyof QuickBooks, pagination: PaginationParams): Promise<PaginatedQueryResult>;
//# sourceMappingURL=pagination.d.ts.map