// QuickBooks report and transaction types

// Common QuickBooks reference type
export interface QBRef {
  value: string;
  name?: string;
}

// QuickBooks API error structure
export interface QBError {
  fault?: {
    error?: Array<{ code?: string; message?: string }>;
  };
}

// Type guard for QB error objects
export function isQBError(error: unknown): error is QBError {
  if (typeof error !== 'object' || error === null) return false;
  const err = error as Record<string, unknown>;
  if (!err.fault || typeof err.fault !== 'object') return false;
  const fault = err.fault as Record<string, unknown>;
  return Array.isArray(fault.error);
}

// QuickBooks entity base
export interface QBEntity {
  Id: string;
  SyncToken?: string;
  TxnDate?: string;
  DocNumber?: string;
  PrivateNote?: string;
  TotalAmt?: number;
  Line?: QBLine[];
}

// Line item types
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

// Journal Entry specific
export interface QBJournalEntry extends QBEntity {
  Line: Array<QBLine & {
    JournalEntryLineDetail: {
      PostingType: string;
      AccountRef: QBRef;
      DepartmentRef?: QBRef;
    };
  }>;
}

// Purchase/Expense specific
export interface QBPurchase extends QBEntity {
  PaymentType: string;
  AccountRef?: QBRef;
  EntityRef?: QBRef & { type?: string };
}

// Bill specific
export interface QBBill extends QBEntity {
  DueDate?: string;
  VendorRef: QBRef;
  APAccountRef?: QBRef;
}

// Deposit specific
export interface QBDeposit extends QBEntity {
  DepositToAccountRef?: QBRef;
}

// Sales Receipt specific
export interface QBSalesReceipt extends QBEntity {
  DepositToAccountRef?: QBRef;
  DepartmentRef?: QBRef;
}

// Payment specific
export interface QBPayment extends QBEntity {
  DepositToAccountRef?: QBRef;
}

// Query response wrapper
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
    Option?: Array<{ Name: string; Value: string }>;
  };
  Columns?: {
    Column?: Array<{ ColTitle?: string; ColType?: string }>;
  };
  Rows?: {
    Row?: Array<{
      type?: string;
      group?: string;
      Summary?: { ColData?: Array<{ value?: string }> };
      Rows?: { Row?: Array<unknown> };
    }>;
  };
}

export interface TransactionLine {
  date: string;
  type: string;
  txnId: string;
  docNumber?: string;
  lineId: string;
  amount: number;        // Positive = debit, Negative = credit
  description?: string;
  department?: string;
  qboLink: string;
  accountId: string;           // Account ID for this line
  accountName: string;         // Account name (e.g., "4010 Sales" or "Undeposited Funds")
  isMatchingLine: boolean;     // True if this line matched the target account query
}
