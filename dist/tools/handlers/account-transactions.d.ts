import QuickBooks from "node-quickbooks";
export declare function handleQueryAccountTransactions(client: QuickBooks, args: {
    account: string;
    start_date?: string;
    end_date?: string;
    department?: string;
}): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
//# sourceMappingURL=account-transactions.d.ts.map