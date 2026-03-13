import QuickBooks from "node-quickbooks";
export declare function handleAccountPeriodSummary(client: QuickBooks, args: {
    account: string;
    start_date?: string;
    end_date?: string;
    department?: string;
    accounting_method?: string;
}): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
//# sourceMappingURL=account-period-summary.d.ts.map