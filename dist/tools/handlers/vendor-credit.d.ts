import QuickBooks from "node-quickbooks";
interface CreateVendorCreditLine {
    account_id?: string;
    account_name?: string;
    amount: number;
    description?: string;
}
interface VendorCreditLineChange {
    line_id?: string;
    account_name?: string;
    amount?: number;
    description?: string;
    delete?: boolean;
}
export declare function handleCreateVendorCredit(client: QuickBooks, args: {
    vendor_name?: string;
    vendor_id?: string;
    txn_date: string;
    department_name?: string;
    department_id?: string;
    class_name?: string;
    ap_account?: string;
    memo?: string;
    doc_number?: string;
    lines: CreateVendorCreditLine[];
    draft?: boolean;
}): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
export declare function handleGetVendorCredit(client: QuickBooks, args: {
    id: string;
}): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
export declare function handleEditVendorCredit(client: QuickBooks, args: {
    id: string;
    vendor_name?: string;
    txn_date?: string;
    memo?: string;
    doc_number?: string;
    class_name?: string;
    lines?: VendorCreditLineChange[];
    draft?: boolean;
}): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
export {};
//# sourceMappingURL=vendor-credit.d.ts.map