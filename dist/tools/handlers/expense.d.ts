import QuickBooks from "node-quickbooks";
interface CreateExpenseLine {
    account_id?: string;
    account_name?: string;
    amount: number;
    description?: string;
}
interface ExpenseLineChange {
    line_id?: string;
    account_name?: string;
    amount?: number;
    description?: string;
    delete?: boolean;
}
export declare function handleCreateExpense(client: QuickBooks, args: {
    payment_type: "Cash" | "Check" | "CreditCard";
    payment_account: string;
    txn_date: string;
    entity_name?: string;
    entity_id?: string;
    department_name?: string;
    department_id?: string;
    class_name?: string;
    memo?: string;
    doc_number?: string;
    lines: CreateExpenseLine[];
    draft?: boolean;
}): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
export declare function handleGetExpense(client: QuickBooks, args: {
    id: string;
}): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
export declare function handleEditExpense(client: QuickBooks, args: {
    id: string;
    txn_date?: string;
    memo?: string;
    payment_account?: string;
    department_name?: string;
    class_name?: string;
    entity_name?: string;
    entity_id?: string;
    lines?: ExpenseLineChange[];
    draft?: boolean;
}): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
export {};
//# sourceMappingURL=expense.d.ts.map