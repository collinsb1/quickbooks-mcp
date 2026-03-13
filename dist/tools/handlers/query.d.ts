import QuickBooks from "node-quickbooks";
export declare function handleQuery(client: QuickBooks, args: {
    query: string;
}): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
    isError?: boolean;
}>;
//# sourceMappingURL=query.d.ts.map