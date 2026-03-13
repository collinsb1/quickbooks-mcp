// Handler for query tool
import { getQboUrl, outputReport } from "../../utils/index.js";
import { parsePaginationFromQuery, paginatedQuery, SAFETY_LIMIT, WARNING_THRESHOLD, buildQueryErrorMessage, summarizeTransactionLines, } from "../../query/index.js";
import { isQBError, extractQBErrorInfo } from "../../types/index.js";
export async function handleQuery(client, args) {
    const { query } = args;
    // Parse pagination params from query
    const pagination = parsePaginationFromQuery(query);
    // Determine entity type from query for appropriate finder method
    const entityMatch = query.match(/FROM\s+(\w+)/i);
    if (!entityMatch) {
        throw new Error("Invalid query: must contain FROM clause");
    }
    const entity = entityMatch[1];
    // Handle irregular plurals for finder method names
    const pluralMap = {
        'JournalEntry': 'JournalEntries',
        'Company': 'CompanyInfos',
        'Class': 'Classes',
        'TaxAgency': 'TaxAgencies',
    };
    const plural = pluralMap[entity] || `${entity}s`;
    const finderMethod = `find${plural}`;
    if (typeof client[finderMethod] !== 'function') {
        throw new Error(`Unknown entity type: ${entity}. Try: Customer, Vendor, Invoice, Bill, Account, Item, Department, JournalEntry, Purchase, Payment, SalesReceipt, Deposit`);
    }
    // Execute paginated query with enhanced error handling
    let paginationResult;
    try {
        paginationResult = await paginatedQuery(client, finderMethod, pagination);
    }
    catch (error) {
        // QB query errors (non-filterable fields, bad syntax) get enhanced messages
        if (isQBError(error)) {
            const { code, message, detail } = extractQBErrorInfo(error);
            const errorMessage = buildQueryErrorMessage(entity, code, message, detail, error);
            return {
                content: [{ type: "text", text: errorMessage }],
                isError: true,
            };
        }
        // Non-QB errors (auth, network) re-throw for executeTool to handle
        throw error;
    }
    let { entities } = paginationResult;
    const { entityKey, apiCalls, truncated, startPositionSpecified, hasMore, returnedCount, requestedLimit } = paginationResult;
    const count = entities.length;
    // Add QBO links for linkable transaction entities
    const linkableEntities = ['journalentry', 'purchase', 'deposit', 'salesreceipt', 'bill', 'invoice', 'payment'];
    const isLinkable = linkableEntities.includes(entity.toLowerCase());
    if (isLinkable && entities.length > 0) {
        entities = entities.map((record) => ({
            ...record,
            QboLink: record.Id ? getQboUrl(entity, record.Id) : null
        }));
    }
    // Build result object for file output
    const result = {
        QueryResponse: {
            [entityKey]: entities
        }
    };
    // Build summary with pagination status
    const summaryLines = [
        `Query: ${entity}`,
        `Results: ${count} records${isLinkable ? ' (with QBO links)' : ''}`
    ];
    // Add pagination info
    if (startPositionSpecified) {
        summaryLines.push('Note: STARTPOSITION specified - no auto-pagination');
    }
    else if (apiCalls > 1) {
        summaryLines.push(`Fetched in ${apiCalls} API calls`);
    }
    // Add warnings and "more data" guidance
    if (truncated) {
        summaryLines.push(`Warning: Results truncated at ${SAFETY_LIMIT} records (safety limit)`);
    }
    else if (hasMore) {
        summaryLines.push(`Note: Results limited to ${requestedLimit} by MAXRESULTS. More data exists.`);
        const nextPosition = (startPositionSpecified ? (pagination.startPosition || 1) : 1) + returnedCount;
        summaryLines.push(`To fetch more: Add "STARTPOSITION ${nextPosition}" to query.`);
    }
    else if (count >= WARNING_THRESHOLD) {
        summaryLines.push(`Warning: Large result set (>${WARNING_THRESHOLD} records)`);
    }
    const txnSummary = summarizeTransactionLines(entity, entities);
    if (txnSummary) {
        summaryLines.push('');
        summaryLines.push(txnSummary);
    }
    return outputReport(`query-${entity.toLowerCase()}`, result, summaryLines.join("\n"));
}
//# sourceMappingURL=query.js.map