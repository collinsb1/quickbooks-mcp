// Handler for deleting QuickBooks entities
import { promisify } from "../../client/index.js";
import { formatDollars } from "../../utils/index.js";
const ENTITY_CONFIG = {
    journal_entry: {
        getMethod: "getJournalEntry",
        deleteMethod: "deleteJournalEntry",
        label: "Journal Entry",
        formatSummary: (e) => {
            const lines = [`Journal Entry #${e.Id}`];
            lines.push(`  Date: ${e.TxnDate}`);
            if (e.DocNumber)
                lines.push(`  Journal no.: ${e.DocNumber}`);
            if (e.TotalAmt != null)
                lines.push(`  Total: ${formatDollars(e.TotalAmt)}`);
            if (e.PrivateNote)
                lines.push(`  Memo: ${e.PrivateNote}`);
            return lines.join("\n");
        },
    },
    bill: {
        getMethod: "getBill",
        deleteMethod: "deleteBill",
        label: "Bill",
        formatSummary: (e) => {
            const vendor = e.VendorRef?.name || "(no vendor)";
            const lines = [`Bill #${e.Id} — ${vendor}`];
            lines.push(`  Date: ${e.TxnDate}`);
            if (e.DueDate)
                lines.push(`  Due: ${e.DueDate}`);
            if (e.DocNumber)
                lines.push(`  Ref no.: ${e.DocNumber}`);
            if (e.TotalAmt != null)
                lines.push(`  Total: ${formatDollars(e.TotalAmt)}`);
            if (e.PrivateNote)
                lines.push(`  Memo: ${e.PrivateNote}`);
            return lines.join("\n");
        },
    },
    invoice: {
        getMethod: "getInvoice",
        deleteMethod: "deleteInvoice",
        label: "Invoice",
        formatSummary: (e) => {
            const customer = e.CustomerRef?.name || "(no customer)";
            const lines = [`Invoice #${e.Id} — ${customer}`];
            lines.push(`  Date: ${e.TxnDate}`);
            if (e.DueDate)
                lines.push(`  Due: ${e.DueDate}`);
            if (e.DocNumber)
                lines.push(`  Ref no.: ${e.DocNumber}`);
            if (e.TotalAmt != null)
                lines.push(`  Total: ${formatDollars(e.TotalAmt)}`);
            if (e.Balance != null)
                lines.push(`  Balance: ${formatDollars(e.Balance)}`);
            if (e.PrivateNote)
                lines.push(`  Memo: ${e.PrivateNote}`);
            return lines.join("\n");
        },
    },
    deposit: {
        getMethod: "getDeposit",
        deleteMethod: "deleteDeposit",
        label: "Deposit",
        formatSummary: (e) => {
            const acct = e.DepositToAccountRef?.name || "(unknown account)";
            const lines = [`Deposit #${e.Id} — to ${acct}`];
            lines.push(`  Date: ${e.TxnDate}`);
            if (e.TotalAmt != null)
                lines.push(`  Total: ${formatDollars(e.TotalAmt)}`);
            if (e.PrivateNote)
                lines.push(`  Memo: ${e.PrivateNote}`);
            return lines.join("\n");
        },
    },
    sales_receipt: {
        getMethod: "getSalesReceipt",
        deleteMethod: "deleteSalesReceipt",
        label: "Sales Receipt",
        formatSummary: (e) => {
            const customer = e.CustomerRef?.name || "(no customer)";
            const lines = [`Sales Receipt #${e.Id} — ${customer}`];
            lines.push(`  Date: ${e.TxnDate}`);
            if (e.DocNumber)
                lines.push(`  Ref no.: ${e.DocNumber}`);
            if (e.TotalAmt != null)
                lines.push(`  Total: ${formatDollars(e.TotalAmt)}`);
            if (e.PrivateNote)
                lines.push(`  Memo: ${e.PrivateNote}`);
            return lines.join("\n");
        },
    },
    expense: {
        getMethod: "getPurchase",
        deleteMethod: "deletePurchase",
        label: "Expense",
        formatSummary: (e) => {
            const payee = e.EntityRef?.name || "(no payee)";
            const lines = [`Expense #${e.Id} — ${payee}`];
            lines.push(`  Date: ${e.TxnDate}`);
            if (e.PaymentType)
                lines.push(`  Payment type: ${e.PaymentType}`);
            if (e.DocNumber)
                lines.push(`  Ref no.: ${e.DocNumber}`);
            if (e.TotalAmt != null)
                lines.push(`  Total: ${formatDollars(e.TotalAmt)}`);
            if (e.PrivateNote)
                lines.push(`  Memo: ${e.PrivateNote}`);
            return lines.join("\n");
        },
    },
    vendor_credit: {
        getMethod: "getVendorCredit",
        deleteMethod: "deleteVendorCredit",
        label: "Vendor Credit",
        formatSummary: (e) => {
            const vendor = e.VendorRef?.name || "(no vendor)";
            const lines = [`Vendor Credit #${e.Id} — ${vendor}`];
            lines.push(`  Date: ${e.TxnDate}`);
            if (e.DocNumber)
                lines.push(`  Ref no.: ${e.DocNumber}`);
            if (e.TotalAmt != null)
                lines.push(`  Total: ${formatDollars(e.TotalAmt)}`);
            if (e.PrivateNote)
                lines.push(`  Memo: ${e.PrivateNote}`);
            return lines.join("\n");
        },
    },
};
const VALID_TYPES = Object.keys(ENTITY_CONFIG).join(", ");
export async function handleDeleteEntity(client, args) {
    const { entity_type, id, confirm = false } = args;
    const config = ENTITY_CONFIG[entity_type];
    if (!config) {
        throw new Error(`Invalid entity_type "${entity_type}". Must be one of: ${VALID_TYPES}`);
    }
    if (!confirm) {
        // Preview: fetch and show summary
        const entity = await promisify((cb) => client[config.getMethod](id, cb));
        const summary = config.formatSummary(entity);
        return {
            content: [{
                    type: "text",
                    text: `${summary}\n\nThis will permanently delete this ${config.label.toLowerCase()}. Call again with confirm=true to delete.`,
                }],
        };
    }
    // Execute delete
    await promisify((cb) => client[config.deleteMethod]({ Id: id }, cb));
    return {
        content: [{
                type: "text",
                text: `Deleted ${config.label} #${id}.`,
            }],
    };
}
//# sourceMappingURL=delete.js.map