import QuickBooks from "node-quickbooks";
interface CreateBillLine {
    account_id?: string;
    account_name?: string;
    amount: number;
    description?: string;
}
interface BillLineChange {
    line_id?: string;
    account_name?: string;
    amount?: number;
    description?: string;
    delete?: boolean;
}
export declare function handleCreateBill(client: QuickBooks, args: {
    vendor_name?: string;
    vendor_id?: string;
    txn_date: string;
    due_date?: string;
    department_name?: string;
    department_id?: string;
    class_name?: string;
    ap_account?: string;
    memo?: string;
    doc_number?: string;
    lines: CreateBillLine[];
    draft?: boolean;
}): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
export declare function handleGetBill(client: QuickBooks, args: {
    id: string;
}): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
export declare function handleEditBill(client: QuickBooks, args: {
    id: string;
    vendor_name?: string;
    txn_date?: string;
    due_date?: string;
    memo?: string;
    department_name?: string;
    class_name?: string;
    doc_number?: string;
    lines?: BillLineChange[];
    draft?: boolean;
}): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
export {};
//# sourceMappingURL=bill.d.ts.map