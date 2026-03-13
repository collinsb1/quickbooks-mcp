import QuickBooks from "node-quickbooks";
export declare function handleGetProfitLoss(client: QuickBooks, args: {
    start_date?: string;
    end_date?: string;
    summarize_by?: string;
    department?: string;
    class_name?: string;
    accounting_method?: string;
}): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
export declare function handleGetBalanceSheet(client: QuickBooks, args: {
    as_of_date?: string;
    summarize_by?: string;
    department?: string;
    class_name?: string;
    accounting_method?: string;
}): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
export declare function handleGetTrialBalance(client: QuickBooks, args: {
    start_date?: string;
    end_date?: string;
    accounting_method?: string;
}): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
//# sourceMappingURL=reports.d.ts.map