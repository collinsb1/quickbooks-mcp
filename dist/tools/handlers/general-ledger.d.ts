import QuickBooks from "node-quickbooks";
export interface GLLine {
    date: string;
    txnType: string;
    num: string;
    name: string;
    memo: string;
    split: string;
    amount: number;
    balance: number;
}
export declare function handleGetGeneralLedger(client: QuickBooks, args: {
    account: string;
    start_date: string;
    end_date: string;
    department?: string;
    accounting_method?: string;
}): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
//# sourceMappingURL=general-ledger.d.ts.map