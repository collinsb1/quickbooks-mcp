// Handler for get_general_ledger tool
//
// Uses the GeneralLedger report to expose full line-level GL detail for an account
// over a required date range. Sees ALL transaction types including Transfers —
// unlike query_account_transactions which misses the Transfer entity type.
//
// GL report column layout:
//   Date | Transaction Type | Num | Name | Memo/Description | Split | Amount | Balance
//   Amount: negative = debit, positive = credit (QBO convention for this report)
//   Balance: running balance; empty on Summary rows
//   "Beginning Balance" Data row: Balance column = opening balance
//
// Summary stats always reflect the full dataset.
// Transaction lines are capped at GL_LINE_LIMIT; truncation warning is included when hit.
import { resolveAccount, resolveDepartmentId, promisify } from "../../client/index.js";
import { outputReport } from "../../utils/index.js";
const GL_LINE_LIMIT = 500;
function parseGLReportDetail(report) {
    const columns = report.Columns?.Column ?? [];
    // Locate column indices by title
    const dateIdx = columns.findIndex(c => c.ColTitle === "Date");
    const txnTypeIdx = columns.findIndex(c => c.ColTitle === "Transaction Type");
    const numIdx = columns.findIndex(c => c.ColTitle === "Num");
    const nameIdx = columns.findIndex(c => c.ColTitle === "Name");
    const memoIdx = columns.findIndex(c => c.ColTitle === "Memo/Description");
    const splitIdx = columns.findIndex(c => c.ColTitle === "Split");
    const amountIdx = columns.findIndex(c => c.ColTitle === "Amount");
    const balanceIdx = columns.findIndex(c => c.ColTitle === "Balance");
    let openingBalance = 0;
    let closingBalance = 0;
    let totalDebits = 0;
    let totalCredits = 0;
    let transactionCount = 0;
    const lines = [];
    function getVal(colData, idx) {
        return idx >= 0 ? (colData[idx]?.value ?? "") : "";
    }
    function processRows(rowList) {
        for (const row of rowList) {
            // Recurse into nested sections (parent account → child account groupings)
            if (row.Rows?.Row) {
                processRows(row.Rows.Row);
            }
            if (row.type === "Data" && row.ColData) {
                const colData = row.ColData;
                const firstCol = colData[0]?.value ?? "";
                // Beginning Balance pseudo-row — balance column holds opening balance
                if (firstCol === "Beginning Balance") {
                    if (balanceIdx >= 0 && colData[balanceIdx]?.value) {
                        openingBalance += parseFloat(colData[balanceIdx].value) || 0;
                    }
                    continue;
                }
                // Regular transaction row
                const amount = amountIdx >= 0 && colData[amountIdx]?.value
                    ? parseFloat(colData[amountIdx].value) || 0
                    : 0;
                const balance = balanceIdx >= 0 && colData[balanceIdx]?.value
                    ? parseFloat(colData[balanceIdx].value) || 0
                    : 0;
                if (amount !== 0) {
                    transactionCount++;
                    if (amount < 0) {
                        totalDebits += Math.abs(amount); // negative amount = debit
                    }
                    else {
                        totalCredits += amount; // positive amount = credit
                    }
                }
                // Running balance — last non-empty balance = closing balance
                if (balanceIdx >= 0 && colData[balanceIdx]?.value) {
                    closingBalance = parseFloat(colData[balanceIdx].value) || 0;
                }
                lines.push({
                    date: getVal(colData, dateIdx),
                    txnType: getVal(colData, txnTypeIdx),
                    num: getVal(colData, numIdx),
                    name: getVal(colData, nameIdx),
                    memo: getVal(colData, memoIdx),
                    split: getVal(colData, splitIdx),
                    amount,
                    balance,
                });
            }
        }
    }
    processRows(report.Rows?.Row ?? []);
    // If no transactions occurred, closing = opening
    if (transactionCount === 0) {
        closingBalance = openingBalance;
    }
    const netActivity = totalCredits - totalDebits;
    return {
        openingBalance,
        closingBalance,
        totalDebits,
        totalCredits,
        netActivity,
        transactionCount,
        lines,
    };
}
export async function handleGetGeneralLedger(client, args) {
    const { account, start_date, end_date, department, accounting_method } = args;
    // Resolve account using cache
    const resolvedAccount = await resolveAccount(client, account);
    // Build report options
    const options = {
        account: resolvedAccount.Id,
        start_date,
        end_date,
    };
    if (department) {
        options.department = await resolveDepartmentId(client, department);
    }
    if (accounting_method) {
        options.accounting_method = accounting_method;
    }
    // Fetch the GeneralLedger report (same endpoint as account_period_summary)
    const report = (await promisify((cb) => client.reportGeneralLedgerDetail(options, cb)));
    // Parse into structured line-level data
    const parsed = parseGLReportDetail(report);
    // Cap lines at GL_LINE_LIMIT — summary stats always reflect the full dataset
    const truncated = parsed.lines.length > GL_LINE_LIMIT;
    const outputLines = truncated ? parsed.lines.slice(0, GL_LINE_LIMIT) : parsed.lines;
    const formatCurrency = (n) => {
        const sign = n < 0 ? "-" : "";
        return `${sign}$${Math.abs(n).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    };
    const acctLabel = resolvedAccount.AcctNum
        ? `${resolvedAccount.AcctNum} ${resolvedAccount.FullyQualifiedName || resolvedAccount.Name}`
        : resolvedAccount.FullyQualifiedName || resolvedAccount.Name;
    const summaryLines = [
        "General Ledger Detail",
        "=====================",
        `Account: ${acctLabel} (${resolvedAccount.AccountType})`,
        `Period:  ${start_date} to ${end_date}`,
    ];
    if (department)
        summaryLines.push(`Department: ${department}`);
    if (accounting_method)
        summaryLines.push(`Basis: ${accounting_method}`);
    summaryLines.push("");
    summaryLines.push(`Opening Balance:  ${formatCurrency(parsed.openingBalance)}`);
    summaryLines.push(`Total Debits:     ${formatCurrency(parsed.totalDebits)}`);
    summaryLines.push(`Total Credits:    ${formatCurrency(parsed.totalCredits)}`);
    summaryLines.push(`Net Activity:     ${formatCurrency(parsed.netActivity)}`);
    summaryLines.push(`Closing Balance:  ${formatCurrency(parsed.closingBalance)}`);
    summaryLines.push(`Transactions:     ${parsed.transactionCount}`);
    if (truncated) {
        summaryLines.push("");
        summaryLines.push(`WARNING: Result truncated — showing ${GL_LINE_LIMIT} of ${parsed.transactionCount} transactions. ` +
            `Narrow your date range to retrieve all detail.`);
    }
    const reportData = {
        account: {
            id: resolvedAccount.Id,
            acctNum: resolvedAccount.AcctNum,
            name: resolvedAccount.FullyQualifiedName || resolvedAccount.Name,
            type: resolvedAccount.AccountType,
        },
        dateRange: {
            start: start_date,
            end: end_date,
        },
        department: department || undefined,
        accountingMethod: accounting_method || "Accrual",
        summary: {
            openingBalance: parsed.openingBalance,
            closingBalance: parsed.closingBalance,
            totalDebits: parsed.totalDebits,
            totalCredits: parsed.totalCredits,
            netActivity: parsed.netActivity,
            transactionCount: parsed.transactionCount,
        },
        truncated,
        linesReturned: outputLines.length,
        lines: outputLines,
    };
    return outputReport("general-ledger", reportData, summaryLines.join("\n"));
}
//# sourceMappingURL=general-ledger.js.map