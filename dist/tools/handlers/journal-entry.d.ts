import QuickBooks from "node-quickbooks";
interface JournalEntryLine {
    account_id?: string;
    account_name?: string;
    amount: number;
    posting_type: "Debit" | "Credit";
    class_id?: string;
    class_name?: string;
    department_id?: string;
    department_name?: string;
}
interface JournalEntryLineChange {
    line_id?: string;
    account_name?: string;
    amount?: number;
    posting_type?: "Debit" | "Credit";
    class_name?: string;
    department_name?: string;
    delete?: boolean;
}
export declare function handleCreateJournalEntry(client: QuickBooks, args: {
    txn_date: string;
    description: string;
    entity_name: string;
    confirm_entity?: boolean;
    memo?: string;
    lines: JournalEntryLine[];
    draft?: boolean;
    doc_number?: string;
}): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
export declare function handleGetJournalEntry(client: QuickBooks, args: {
    id: string;
}): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
export declare function handleEditJournalEntry(client: QuickBooks, args: {
    id: string;
    txn_date?: string;
    description?: string;
    entity_name?: string;
    confirm_entity?: boolean;
    memo?: string;
    doc_number?: string;
    lines?: JournalEntryLineChange[];
    draft?: boolean;
}): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
export {};
//# sourceMappingURL=journal-entry.d.ts.map