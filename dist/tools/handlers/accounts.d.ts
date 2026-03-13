import QuickBooks from "node-quickbooks";
export declare function handleListAccounts(client: QuickBooks, args: {
    account_type?: string;
    active_only?: boolean;
}): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
//# sourceMappingURL=accounts.d.ts.map