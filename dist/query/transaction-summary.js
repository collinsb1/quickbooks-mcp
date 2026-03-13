// Transaction line-item summaries for query results
// Enhances text summaries with per-transaction line breakdowns
import { isHttpMode } from "../utils/output.js";
const TRANSACTION_ENTITIES = new Set([
    "journalentry", "purchase", "bill", "deposit",
    "salesreceipt", "invoice", "payment",
]);
function formatAmount(amount) {
    return `$${Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function extractLineSummary(line) {
    const amount = line.Amount ?? 0;
    const detailType = line.DetailType;
    if (!detailType || detailType === "SubTotalLineDetail" || amount === 0) {
        return null;
    }
    if (detailType === "JournalEntryLineDetail") {
        const detail = line.JournalEntryLineDetail;
        const accountRef = detail?.AccountRef;
        const postingType = detail?.PostingType === "Credit" ? "CR" : "DR";
        return { amount, label: accountRef?.name || "Unknown", postingType };
    }
    if (detailType === "AccountBasedExpenseLineDetail") {
        const detail = line.AccountBasedExpenseLineDetail;
        const accountRef = detail?.AccountRef;
        return { amount, label: accountRef?.name || "Unknown" };
    }
    if (detailType === "DepositLineDetail") {
        const detail = line.DepositLineDetail;
        const accountRef = detail?.AccountRef;
        return { amount, label: accountRef?.name || "Unknown" };
    }
    if (detailType === "SalesItemLineDetail") {
        const detail = line.SalesItemLineDetail;
        const itemRef = detail?.ItemRef;
        const qty = detail?.Qty;
        let label = itemRef?.name || "Unknown";
        if (qty && qty > 1)
            label += ` (x${qty})`;
        return { amount, label };
    }
    if (detailType === "ItemBasedExpenseLineDetail") {
        const detail = line.ItemBasedExpenseLineDetail;
        const itemRef = detail?.ItemRef;
        const qty = detail?.Qty;
        let label = itemRef?.name || "Unknown";
        if (qty && qty > 1)
            label += ` (x${qty})`;
        return { amount, label };
    }
    return null;
}
function formatTransaction(entity, record) {
    const entityLower = entity.toLowerCase();
    const docNumber = record.DocNumber;
    const txnDate = record.TxnDate;
    const totalAmt = record.TotalAmt ?? 0;
    // Build header: EntityType #DocNumber (date) $total
    let header = entity;
    if (docNumber)
        header += ` #${docNumber}`;
    if (txnDate)
        header += ` (${txnDate})`;
    header += ` ${formatAmount(totalAmt)}`;
    // Entity/vendor context
    const vendorRef = record.VendorRef;
    const entityRef = record.EntityRef;
    const customerRef = record.CustomerRef;
    const deptRef = record.DepartmentRef;
    const contextParts = [];
    if (vendorRef?.name)
        contextParts.push(vendorRef.name);
    if (entityRef?.name)
        contextParts.push(entityRef.name);
    if (customerRef?.name)
        contextParts.push(customerRef.name);
    if (deptRef?.name)
        contextParts.push(`Dept: ${deptRef.name}`);
    // Extract line summaries
    const lines = record.Line || [];
    const summaries = lines.map(extractLineSummary).filter((s) => s !== null);
    const isJournal = entityLower === "journalentry";
    if (summaries.length === 0) {
        // No meaningful lines - header only with context
        if (contextParts.length > 0)
            header += `  [${contextParts.join(", ")}]`;
        return header;
    }
    if (summaries.length === 1 && !isJournal) {
        // Single line - inline
        header += `  ${summaries[0].label}`;
        if (contextParts.length > 0)
            header += `  [${contextParts.join(", ")}]`;
        return header;
    }
    // Multi-line - header + indented sub-lines
    if (contextParts.length > 0)
        header += `  [${contextParts.join(", ")}]`;
    const subLines = summaries.map(s => {
        const prefix = isJournal && s.postingType ? `${s.postingType}  ` : "";
        return `  ${prefix}${formatAmount(s.amount)}  ${s.label}`;
    });
    return [header, ...subLines].join("\n");
}
/**
 * Generate a compact line-item summary for transaction query results.
 * Returns null for non-transaction entities (Customer, Vendor, Account, etc.)
 */
export function summarizeTransactionLines(entity, entities) {
    if (!TRANSACTION_ENTITIES.has(entity.toLowerCase())) {
        return null;
    }
    if (entities.length === 0) {
        return null;
    }
    const cap = isHttpMode() ? 25 : 50;
    const displayed = entities.slice(0, cap);
    const remaining = entities.length - displayed.length;
    const lines = displayed.map(record => formatTransaction(entity, record));
    if (remaining > 0) {
        lines.push(`... and ${remaining} more (see full data)`);
    }
    return lines.join("\n");
}
//# sourceMappingURL=transaction-summary.js.map