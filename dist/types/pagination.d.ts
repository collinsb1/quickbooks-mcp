export interface PaginationParams {
    maxResults: number;
    startPosition: number | null;
    baseCriteria: string;
}
export interface PaginatedQueryResult {
    entities: Array<{
        Id?: string;
        [key: string]: unknown;
    }>;
    entityKey: string;
    apiCalls: number;
    truncated: boolean;
    startPositionSpecified: boolean;
    hasMore: boolean;
    returnedCount: number;
    requestedLimit: number;
}
//# sourceMappingURL=pagination.d.ts.map