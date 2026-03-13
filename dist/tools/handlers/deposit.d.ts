import QuickBooks from "node-quickbooks";
interface CreateDepositLineInput {
    amount: number;
    account_name?: string;
    account_id?: string;
    description?: string;
    entity_name?: string;
    entity_id?: string;
}
interface DepositLineInput {
    line_id?: string;
    amount: number;
    account_name: string;
    description?: string;
}
export declare function handleCreateDeposit(client: QuickBooks, args: {
    deposit_to_account: string;
    txn_date: string;
    lines: CreateDepositLineInput[];
    department_name?: string;
    department_id?: string;
    memo?: string;
    draft?: boolean;
}): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
export declare function handleGetDeposit(client: QuickBooks, args: {
    id: string;
}): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
export declare function handleEditDeposit(client: QuickBooks, args: {
    id: string;
    txn_date?: string;
    memo?: string;
    deposit_to_account?: string;
    department_name?: string;
    lines?: DepositLineInput[];
    draft?: boolean;
    expected_total?: number;
}): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
export {};
//# sourceMappingURL=deposit.d.ts.map