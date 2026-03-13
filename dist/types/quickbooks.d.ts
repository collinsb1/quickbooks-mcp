export interface QBRef {
    value: string;
    name?: string;
}
export interface QBError {
    Fault?: {
        Error?: Array<{
            code?: string;
            Code?: string;
            message?: string;
            Message?: string;
            Detail?: string;
            detail?: string;
        }>;
    };
    fault?: {
        error?: Array<{
            code?: string;
            Code?: string;
            message?: string;
            Message?: string;
            Detail?: string;
            detail?: string;
        }>;
    };
}
export declare function isQBError(error: unknown): error is QBError;
export declare function extractQBErrorInfo(error: QBError): {
    code?: string;
    message?: string;
    detail?: string;
};
export interface QBEntity {
    Id: string;
    SyncToken?: string;
    TxnDate?: string;
    DocNumber?: string;
    PrivateNote?: string;
    TotalAmt?: number;
    Line?: QBLine[];
}
export interface QBLine {
    Id: string;
    Amount: number;
    Description?: string;
    DetailType: string;
    JournalEntryLineDetail?: {
        PostingType: string;
        AccountRef: QBRef;
        DepartmentRef?: QBRef;
    };
    AccountBasedExpenseLineDetail?: {
        AccountRef: QBRef;
        DepartmentRef?: QBRef;
    };
    DepositLineDetail?: {
        AccountRef?: QBRef;
        DepartmentRef?: QBRef;
    };
    SalesItemLineDetail?: {
        ItemRef?: QBRef;
        Qty?: number;
        UnitPrice?: number;
    };
    ItemBasedExpenseLineDetail?: {
        ItemRef: QBRef;
        Qty?: number;
        UnitPrice?: number;
    };
}
export interface QBJournalEntry extends QBEntity {
    Line: Array<QBLine & {
        JournalEntryLineDetail: {
            PostingType: string;
            AccountRef: QBRef;
            DepartmentRef?: QBRef;
        };
    }>;
}
export interface QBPurchase extends QBEntity {
    PaymentType: string;
    AccountRef?: QBRef;
    EntityRef?: QBRef & {
        type?: string;
    };
}
export interface QBBill extends QBEntity {
    DueDate?: string;
    VendorRef: QBRef;
    APAccountRef?: QBRef;
}
export interface QBDeposit extends QBEntity {
    DepositToAccountRef?: QBRef;
}
export interface QBSalesReceipt extends QBEntity {
    DepositToAccountRef?: QBRef;
    DepartmentRef?: QBRef;
}
export interface QBPayment extends QBEntity {
    DepositToAccountRef?: QBRef;
}
export interface QBQueryResponse<T = unknown> {
    QueryResponse?: {
        [key: string]: T[];
    };
}
export interface QBReport {
    Header?: {
        ReportName?: string;
        StartPeriod?: string;
        EndPeriod?: string;
        DateMacro?: string;
        ReportBasis?: string;
        Currency?: string;
        Option?: Array<{
            Name: string;
            Value: string;
        }>;
    };
    Columns?: {
        Column?: Array<{
            ColTitle?: string;
            ColType?: string;
        }>;
    };
    Rows?: {
        Row?: Array<{
            type?: string;
            group?: string;
            Summary?: {
                ColData?: Array<{
                    value?: string;
                }>;
            };
            Rows?: {
                Row?: Array<unknown>;
            };
        }>;
    };
}
export interface TransactionLine {
    date: string;
    type: string;
    txnId: string;
    docNumber?: string;
    lineId: string;
    amount: number;
    description?: string;
    department?: string;
    qboLink: string;
    accountId: string;
    accountName: string;
    isMatchingLine: boolean;
}
//# sourceMappingURL=quickbooks.d.ts.map