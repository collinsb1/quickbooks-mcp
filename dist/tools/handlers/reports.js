// Handlers for report tools (profit_loss, balance_sheet, trial_balance)
import { promisify, resolveDepartmentId, resolveClassId } from "../../client/index.js";
import { outputReport } from "../../utils/index.js";
import { extractReportSummary } from "../../reports/index.js";
export async function handleGetProfitLoss(client, args) {
    const { start_date, end_date, summarize_by, department, class_name, accounting_method } = args;
    const options = {};
    if (start_date)
        options.start_date = start_date;
    if (end_date)
        options.end_date = end_date;
    if (summarize_by)
        options.summarize_column_by = summarize_by;
    if (department)
        options.department = await resolveDepartmentId(client, department);
    if (class_name)
        options.class = await resolveClassId(client, class_name);
    if (accounting_method)
        options.accounting_method = accounting_method;
    const result = await promisify((cb) => client.reportProfitAndLoss(options, cb));
    const summary = extractReportSummary(result, "Profit and Loss");
    return outputReport("profit-loss", result, summary);
}
export async function handleGetBalanceSheet(client, args) {
    const { as_of_date, summarize_by, department, class_name, accounting_method } = args;
    const options = {};
    if (as_of_date) {
        // Balance sheet needs both start_date and end_date
        // Set start_date to beginning of time for point-in-time report
        options.start_date = "1970-01-01";
        options.end_date = as_of_date;
    }
    if (summarize_by)
        options.summarize_column_by = summarize_by;
    if (department)
        options.department = await resolveDepartmentId(client, department);
    if (class_name)
        options.class = await resolveClassId(client, class_name);
    if (accounting_method)
        options.accounting_method = accounting_method;
    const result = await promisify((cb) => client.reportBalanceSheet(options, cb));
    const summary = extractReportSummary(result, "Balance Sheet");
    return outputReport("balance-sheet", result, summary);
}
export async function handleGetTrialBalance(client, args) {
    const { start_date, end_date, accounting_method } = args;
    const options = {};
    if (start_date)
        options.start_date = start_date;
    if (end_date)
        options.end_date = end_date;
    if (accounting_method)
        options.accounting_method = accounting_method;
    const result = await promisify((cb) => client.reportTrialBalance(options, cb));
    const summary = extractReportSummary(result, "Trial Balance");
    return outputReport("trial-balance", result, summary);
}
//# sourceMappingURL=reports.js.map