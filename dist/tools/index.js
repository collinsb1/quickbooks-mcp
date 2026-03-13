// Tool registry and dispatcher with auth retry
import { getClient, clearCredentialsCache, isAuthError } from "../client/index.js";
import { handleGetCompanyInfo, handleQuery, handleListAccounts, handleGetProfitLoss, handleGetBalanceSheet, handleGetTrialBalance, handleQueryAccountTransactions, handleAccountPeriodSummary, handleGetGeneralLedger, handleCreateJournalEntry, handleGetJournalEntry, handleEditJournalEntry, handleCreateBill, handleGetBill, handleEditBill, handleCreateExpense, handleGetExpense, handleEditExpense, handleCreateSalesReceipt, handleGetSalesReceipt, handleEditSalesReceipt, handleCreateInvoice, handleGetInvoice, handleEditInvoice, handleCreateDeposit, handleGetDeposit, handleEditDeposit, handleCreateVendorCredit, handleGetVendorCredit, handleEditVendorCredit, handleCreateCustomer, handleGetCustomer, handleEditCustomer, handleDeleteEntity, handleAuthenticate, } from "./handlers/index.js";
export { toolDefinitions } from "./definitions.js";
// Tool handler registry
const toolHandlers = new Map();
// Register all tools
toolHandlers.set("get_company_info", (client) => handleGetCompanyInfo(client));
toolHandlers.set("query", (client, args) => handleQuery(client, args));
toolHandlers.set("list_accounts", (client, args) => handleListAccounts(client, args));
toolHandlers.set("get_profit_loss", (client, args) => handleGetProfitLoss(client, args));
toolHandlers.set("get_balance_sheet", (client, args) => handleGetBalanceSheet(client, args));
toolHandlers.set("get_trial_balance", (client, args) => handleGetTrialBalance(client, args));
toolHandlers.set("query_account_transactions", (client, args) => handleQueryAccountTransactions(client, args));
toolHandlers.set("account_period_summary", (client, args) => handleAccountPeriodSummary(client, args));
toolHandlers.set("get_general_ledger", (client, args) => handleGetGeneralLedger(client, args));
toolHandlers.set("create_journal_entry", (client, args) => handleCreateJournalEntry(client, args));
toolHandlers.set("get_journal_entry", (client, args) => handleGetJournalEntry(client, args));
toolHandlers.set("edit_journal_entry", (client, args) => handleEditJournalEntry(client, args));
toolHandlers.set("create_bill", (client, args) => handleCreateBill(client, args));
toolHandlers.set("get_bill", (client, args) => handleGetBill(client, args));
toolHandlers.set("edit_bill", (client, args) => handleEditBill(client, args));
toolHandlers.set("create_expense", (client, args) => handleCreateExpense(client, args));
toolHandlers.set("get_expense", (client, args) => handleGetExpense(client, args));
toolHandlers.set("edit_expense", (client, args) => handleEditExpense(client, args));
toolHandlers.set("create_sales_receipt", (client, args) => handleCreateSalesReceipt(client, args));
toolHandlers.set("get_sales_receipt", (client, args) => handleGetSalesReceipt(client, args));
toolHandlers.set("edit_sales_receipt", (client, args) => handleEditSalesReceipt(client, args));
toolHandlers.set("create_invoice", (client, args) => handleCreateInvoice(client, args));
toolHandlers.set("get_invoice", (client, args) => handleGetInvoice(client, args));
toolHandlers.set("edit_invoice", (client, args) => handleEditInvoice(client, args));
toolHandlers.set("create_deposit", (client, args) => handleCreateDeposit(client, args));
toolHandlers.set("get_deposit", (client, args) => handleGetDeposit(client, args));
toolHandlers.set("edit_deposit", (client, args) => handleEditDeposit(client, args));
toolHandlers.set("create_vendor_credit", (client, args) => handleCreateVendorCredit(client, args));
toolHandlers.set("get_vendor_credit", (client, args) => handleGetVendorCredit(client, args));
toolHandlers.set("edit_vendor_credit", (client, args) => handleEditVendorCredit(client, args));
toolHandlers.set("create_customer", (client, args) => handleCreateCustomer(client, args));
toolHandlers.set("get_customer", (client, args) => handleGetCustomer(client, args));
toolHandlers.set("edit_customer", (client, args) => handleEditCustomer(client, args));
toolHandlers.set("delete_entity", (client, args) => handleDeleteEntity(client, args));
// Execute tool with auth retry logic
export async function executeTool(name, args) {
    // Special case: qbo_authenticate doesn't need a QuickBooks client
    if (name === "qbo_authenticate") {
        return handleAuthenticate(args);
    }
    const handler = toolHandlers.get(name);
    if (!handler) {
        throw new Error(`Unknown tool: ${name}`);
    }
    const executeOperation = async () => {
        const client = await getClient();
        return handler(client, args);
    };
    // Execute with retry on auth failure
    try {
        return await executeOperation();
    }
    catch (error) {
        if (isAuthError(error)) {
            // Clear cache and retry once with fresh credentials from Secrets Manager
            clearCredentialsCache();
            try {
                return await executeOperation();
            }
            catch (retryError) {
                // If retry also fails, return that error
                const errorMessage = typeof retryError === 'object' && retryError !== null
                    ? JSON.stringify(retryError, null, 2)
                    : String(retryError);
                return {
                    content: [{ type: "text", text: `Error after retry: ${errorMessage}` }],
                    isError: true,
                };
            }
        }
        let errorMessage;
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        else if (typeof error === 'object' && error !== null) {
            // node-quickbooks often returns error objects with Fault property
            errorMessage = JSON.stringify(error, null, 2);
        }
        else {
            errorMessage = String(error);
        }
        return {
            content: [{ type: "text", text: `Error: ${errorMessage}` }],
            isError: true,
        };
    }
}
//# sourceMappingURL=index.js.map