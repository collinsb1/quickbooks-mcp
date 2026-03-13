import QuickBooks from "node-quickbooks";
interface InvoiceLineChange {
    line_id?: string;
    item_name?: string;
    item_id?: string;
    amount?: number;
    qty?: number;
    unit_price?: number;
    description?: string;
    delete?: boolean;
}
interface CreateInvoiceLine {
    item_name?: string;
    item_id?: string;
    amount?: number;
    qty?: number;
    unit_price?: number;
    description?: string;
}
export declare function handleCreateInvoice(client: QuickBooks, args: {
    txn_date: string;
    customer_name?: string;
    customer_id?: string;
    due_date?: string;
    department_name?: string;
    department_id?: string;
    class_name?: string;
    memo?: string;
    customer_memo?: string;
    bill_email?: string;
    sales_term_ref?: string;
    allow_online_credit_card_payment?: boolean;
    allow_online_ach_payment?: boolean;
    doc_number?: string;
    lines: CreateInvoiceLine[];
    draft?: boolean;
}): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
export declare function handleGetInvoice(client: QuickBooks, args: {
    id: string;
}): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
export declare function handleEditInvoice(client: QuickBooks, args: {
    id: string;
    txn_date?: string;
    due_date?: string;
    memo?: string;
    customer_memo?: string;
    bill_email?: string;
    sales_term_ref?: string;
    allow_online_credit_card_payment?: boolean;
    allow_online_ach_payment?: boolean;
    customer_name?: string;
    department_name?: string;
    class_name?: string;
    lines?: InvoiceLineChange[];
    draft?: boolean;
}): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
export {};
//# sourceMappingURL=invoice.d.ts.map