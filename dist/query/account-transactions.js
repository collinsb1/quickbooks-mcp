// Extract transaction lines that reference a specific account
import { getQboUrl } from "../utils/index.js";
// Get formatted account name from cache or fallback to ref name
function getAccountName(accountId, accountCache, refName) {
    const cached = accountCache.byId.get(accountId);
    if (cached) {
        return cached.AcctNum ? `${cached.AcctNum} ${cached.Name}` : cached.Name;
    }
    return refName || accountId;
}
// Extract ALL transaction lines from transactions that have ANY line matching the target account
// Returns lines with account info and flags for which lines matched the query
export function extractAccountLines(entities, entityType, targetAccountId, accountCache, departmentFilter) {
    const lines = [];
    for (const entity of entities) {
        const txnId = entity.Id;
        const txnDate = entity.TxnDate;
        const docNumber = entity.DocNumber;
        const qboLink = getQboUrl(entityType, txnId) || '';
        // Helper to check if a line matches the department filter
        const matchesDepartment = (lineDetail) => {
            if (!departmentFilter)
                return true;
            const deptRef = lineDetail.DepartmentRef;
            return deptRef?.value === departmentFilter;
        };
        // Helper to get department name from line
        const getDepartment = (lineDetail) => {
            const deptRef = lineDetail.DepartmentRef;
            return deptRef?.name || deptRef?.value;
        };
        // Extract all lines and check if any match the target account
        const extractedLines = [];
        let hasMatchingLine = false;
        switch (entityType.toLowerCase()) {
            case 'journalentry': {
                const entityLines = entity.Line || [];
                for (const line of entityLines) {
                    const detail = line.JournalEntryLineDetail;
                    if (!detail)
                        continue;
                    if (!matchesDepartment(detail))
                        continue;
                    const accountRef = detail.AccountRef;
                    const accountId = accountRef?.value || '';
                    const isMatching = accountId === targetAccountId;
                    if (isMatching)
                        hasMatchingLine = true;
                    const postingType = detail.PostingType;
                    const amount = line.Amount;
                    // Debit = positive, Credit = negative
                    const signedAmount = postingType === 'Debit' ? amount : -amount;
                    extractedLines.push({
                        date: txnDate,
                        type: 'JournalEntry',
                        txnId,
                        docNumber,
                        lineId: line.Id,
                        amount: signedAmount,
                        description: line.Description,
                        department: getDepartment(detail),
                        qboLink,
                        accountId,
                        accountName: getAccountName(accountId, accountCache, accountRef?.name),
                        isMatchingLine: isMatching
                    });
                }
                break;
            }
            case 'purchase': {
                // Header: AccountRef is the bank/credit card account being debited
                const headerAccountRef = entity.AccountRef;
                const headerAccountId = headerAccountRef?.value || '';
                const headerDeptRef = entity.DepartmentRef;
                const headerMatchesDept = !departmentFilter || headerDeptRef?.value === departmentFilter;
                if (headerAccountId && headerMatchesDept) {
                    const totalAmt = entity.TotalAmt;
                    const isMatching = headerAccountId === targetAccountId;
                    if (isMatching)
                        hasMatchingLine = true;
                    extractedLines.push({
                        date: txnDate,
                        type: 'Purchase',
                        txnId,
                        docNumber,
                        lineId: 'header',
                        amount: -totalAmt, // Credit to bank account
                        description: entity.PrivateNote,
                        department: headerDeptRef?.name,
                        qboLink,
                        accountId: headerAccountId,
                        accountName: getAccountName(headerAccountId, accountCache, headerAccountRef?.name),
                        isMatchingLine: isMatching
                    });
                }
                // Lines: AccountBasedExpenseLineDetail for expense accounts
                const entityLines = entity.Line || [];
                for (const line of entityLines) {
                    const detail = line.AccountBasedExpenseLineDetail;
                    if (!detail)
                        continue;
                    if (!matchesDepartment(detail))
                        continue;
                    const accountRef = detail.AccountRef;
                    const accountId = accountRef?.value || '';
                    const isMatching = accountId === targetAccountId;
                    if (isMatching)
                        hasMatchingLine = true;
                    extractedLines.push({
                        date: txnDate,
                        type: 'Purchase',
                        txnId,
                        docNumber,
                        lineId: line.Id,
                        amount: line.Amount, // Debit to expense account
                        description: line.Description,
                        department: getDepartment(detail),
                        qboLink,
                        accountId,
                        accountName: getAccountName(accountId, accountCache, accountRef?.name),
                        isMatchingLine: isMatching
                    });
                }
                break;
            }
            case 'deposit': {
                // Header: DepositToAccountRef is the bank account being debited
                const depositToRef = entity.DepositToAccountRef;
                const headerAccountId = depositToRef?.value || '';
                const txnDeptRef = entity.DepartmentRef;
                const headerMatchesDept = !departmentFilter || txnDeptRef?.value === departmentFilter;
                if (headerAccountId && headerMatchesDept) {
                    const totalAmt = entity.TotalAmt;
                    const isMatching = headerAccountId === targetAccountId;
                    if (isMatching)
                        hasMatchingLine = true;
                    extractedLines.push({
                        date: txnDate,
                        type: 'Deposit',
                        txnId,
                        docNumber,
                        lineId: 'header',
                        amount: totalAmt, // Debit to bank account
                        description: entity.PrivateNote,
                        department: txnDeptRef?.name || txnDeptRef?.value,
                        qboLink,
                        accountId: headerAccountId,
                        accountName: getAccountName(headerAccountId, accountCache, depositToRef?.name),
                        isMatchingLine: isMatching
                    });
                }
                // Lines: DepositLineDetail.AccountRef
                const entityLines = entity.Line || [];
                for (const line of entityLines) {
                    const detail = line.DepositLineDetail;
                    if (!detail)
                        continue;
                    if (!matchesDepartment(detail))
                        continue;
                    const accountRef = detail.AccountRef;
                    const accountId = accountRef?.value || '';
                    const isMatching = accountId === targetAccountId;
                    if (isMatching)
                        hasMatchingLine = true;
                    extractedLines.push({
                        date: txnDate,
                        type: 'Deposit',
                        txnId,
                        docNumber,
                        lineId: line.Id,
                        amount: -line.Amount, // Credit to source account
                        description: line.Description,
                        department: getDepartment(detail),
                        qboLink,
                        accountId,
                        accountName: getAccountName(accountId, accountCache, accountRef?.name),
                        isMatchingLine: isMatching
                    });
                }
                break;
            }
            case 'salesreceipt': {
                // Header: DepositToAccountRef is the bank account being debited
                const depositToRef = entity.DepositToAccountRef;
                const headerAccountId = depositToRef?.value || '';
                const txnDeptRef = entity.DepartmentRef;
                const headerMatchesDept = !departmentFilter || txnDeptRef?.value === departmentFilter;
                if (headerAccountId && headerMatchesDept) {
                    const totalAmt = entity.TotalAmt;
                    const isMatching = headerAccountId === targetAccountId;
                    if (isMatching)
                        hasMatchingLine = true;
                    extractedLines.push({
                        date: txnDate,
                        type: 'SalesReceipt',
                        txnId,
                        docNumber,
                        lineId: 'header',
                        amount: totalAmt, // Debit to bank account
                        description: entity.PrivateNote,
                        department: txnDeptRef?.name,
                        qboLink,
                        accountId: headerAccountId,
                        accountName: getAccountName(headerAccountId, accountCache, depositToRef?.name),
                        isMatchingLine: isMatching
                    });
                }
                // Lines: SalesItemLineDetail - check ItemAccountRef for income account
                const entityLines = entity.Line || [];
                for (const line of entityLines) {
                    const detail = line.SalesItemLineDetail;
                    if (!detail)
                        continue;
                    if (!matchesDepartment(detail))
                        continue;
                    // Check ItemAccountRef (explicit account override on line)
                    const itemAccountRef = detail.ItemAccountRef;
                    const accountId = itemAccountRef?.value || '';
                    if (!accountId)
                        continue; // Skip lines without explicit account
                    const isMatching = accountId === targetAccountId;
                    if (isMatching)
                        hasMatchingLine = true;
                    // Get item name for description context
                    const itemRef = detail.ItemRef;
                    const itemName = itemRef?.name;
                    const lineDesc = line.Description;
                    const description = lineDesc || itemName;
                    extractedLines.push({
                        date: txnDate,
                        type: 'SalesReceipt',
                        txnId,
                        docNumber,
                        lineId: line.Id,
                        amount: -line.Amount, // Credit to income account
                        description,
                        department: getDepartment(detail),
                        qboLink,
                        accountId,
                        accountName: getAccountName(accountId, accountCache, itemAccountRef?.name),
                        isMatchingLine: isMatching
                    });
                }
                break;
            }
            case 'bill': {
                // Header: APAccountRef is the AP account being credited
                const apAccountRef = entity.APAccountRef;
                const headerAccountId = apAccountRef?.value || '';
                const txnDeptRef = entity.DepartmentRef;
                const headerMatchesDept = !departmentFilter || txnDeptRef?.value === departmentFilter;
                if (headerAccountId && headerMatchesDept) {
                    const totalAmt = entity.TotalAmt;
                    const isMatching = headerAccountId === targetAccountId;
                    if (isMatching)
                        hasMatchingLine = true;
                    extractedLines.push({
                        date: txnDate,
                        type: 'Bill',
                        txnId,
                        docNumber,
                        lineId: 'header',
                        amount: -totalAmt, // Credit to AP
                        description: entity.PrivateNote,
                        department: txnDeptRef?.name || txnDeptRef?.value,
                        qboLink,
                        accountId: headerAccountId,
                        accountName: getAccountName(headerAccountId, accountCache, apAccountRef?.name),
                        isMatchingLine: isMatching
                    });
                }
                // Lines: AccountBasedExpenseLineDetail for expense accounts
                const entityLines = entity.Line || [];
                for (const line of entityLines) {
                    const detail = line.AccountBasedExpenseLineDetail;
                    if (!detail)
                        continue;
                    if (!matchesDepartment(detail))
                        continue;
                    const accountRef = detail.AccountRef;
                    const accountId = accountRef?.value || '';
                    const isMatching = accountId === targetAccountId;
                    if (isMatching)
                        hasMatchingLine = true;
                    extractedLines.push({
                        date: txnDate,
                        type: 'Bill',
                        txnId,
                        docNumber,
                        lineId: line.Id,
                        amount: line.Amount, // Debit to expense account
                        description: line.Description,
                        department: getDepartment(detail),
                        qboLink,
                        accountId,
                        accountName: getAccountName(accountId, accountCache, accountRef?.name),
                        isMatchingLine: isMatching
                    });
                }
                break;
            }
            case 'invoice': {
                // Lines: SalesItemLineDetail - check ItemAccountRef for income account
                const entityLines = entity.Line || [];
                for (const line of entityLines) {
                    const detail = line.SalesItemLineDetail;
                    if (!detail)
                        continue;
                    if (!matchesDepartment(detail))
                        continue;
                    // Check ItemAccountRef (explicit account override on line)
                    const itemAccountRef = detail.ItemAccountRef;
                    const accountId = itemAccountRef?.value || '';
                    if (!accountId)
                        continue; // Skip lines without explicit account
                    const isMatching = accountId === targetAccountId;
                    if (isMatching)
                        hasMatchingLine = true;
                    // Get item name for description context
                    const itemRef = detail.ItemRef;
                    const itemName = itemRef?.name;
                    const lineDesc = line.Description;
                    const description = lineDesc || itemName;
                    extractedLines.push({
                        date: txnDate,
                        type: 'Invoice',
                        txnId,
                        docNumber,
                        lineId: line.Id,
                        amount: -line.Amount, // Credit to income account
                        description,
                        department: getDepartment(detail),
                        qboLink,
                        accountId,
                        accountName: getAccountName(accountId, accountCache, itemAccountRef?.name),
                        isMatchingLine: isMatching
                    });
                }
                break;
            }
            case 'payment': {
                // Header: DepositToAccountRef is where payment goes
                const depositToRef = entity.DepositToAccountRef;
                const accountId = depositToRef?.value || '';
                const txnDeptRef = entity.DepartmentRef;
                const headerMatchesDept = !departmentFilter || txnDeptRef?.value === departmentFilter;
                if (accountId && headerMatchesDept) {
                    const totalAmt = entity.TotalAmt;
                    const isMatching = accountId === targetAccountId;
                    if (isMatching)
                        hasMatchingLine = true;
                    extractedLines.push({
                        date: txnDate,
                        type: 'Payment',
                        txnId,
                        docNumber,
                        lineId: 'header',
                        amount: totalAmt, // Debit to deposit account
                        description: entity.PrivateNote,
                        department: txnDeptRef?.name || txnDeptRef?.value,
                        qboLink,
                        accountId,
                        accountName: getAccountName(accountId, accountCache, depositToRef?.name),
                        isMatchingLine: isMatching
                    });
                }
                break;
            }
        }
        // Only include lines from transactions that have at least one matching line
        if (hasMatchingLine) {
            lines.push(...extractedLines);
        }
    }
    return lines;
}
//# sourceMappingURL=account-transactions.js.map