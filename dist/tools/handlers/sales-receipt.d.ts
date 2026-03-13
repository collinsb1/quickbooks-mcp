import QuickBooks from "node-quickbooks";
interface SalesReceiptLineChange {
    line_id?: string;
    item_name?: string;
    item_id?: string;
    amount?: number;
    qty?: number;
    unit_price?: number;
    description?: string;
    delete?: boolean;
}
interface CreateSalesReceiptLine {
    item_name?: string;
    item_id?: string;
    amount?: number;
    qty?: number;
    unit_price?: number;
    description?: string;
}
export declare function handleCreateSalesReceipt(client: QuickBooks, args: {
    txn_date: string;
    customer_name?: string;
    customer_id?: string;
    deposit_to_account?: string;
    department_name?: string;
    department_id?: string;
    class_name?: string;
    memo?: string;
    doc_number?: string;
    lines: CreateSalesReceiptLine[];
    draft?: boolean;
}): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
export declare function handleGetSalesReceipt(client: QuickBooks, args: {
    id: string;
}): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
export declare function handleEditSalesReceipt(client: QuickBooks, args: {
    id: string;
    txn_date?: string;
    memo?: string;
    deposit_to_account?: string;
    department_name?: string;
    class_name?: string;
    lines?: SalesReceiptLineChange[];
    draft?: boolean;
}): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
export {};
//# sourceMappingURL=sales-receipt.d.ts.map