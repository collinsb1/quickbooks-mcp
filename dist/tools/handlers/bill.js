// Handlers for bill tools (create, get, edit)
import { promisify, getAccountCache, getDepartmentCache, getClassCache, getVendorCache, resolveVendor, } from "../../client/index.js";
import { validateAmount, toDollars, formatDollars, sumCents, outputReport } from "../../utils/index.js";
export async function handleCreateBill(client, args) {
    const { vendor_name, vendor_id, txn_date, due_date, department_name, department_id, class_name, ap_account, memo, doc_number, lines, draft = true, } = args;
    if (!lines || lines.length === 0) {
        throw new Error("At least one line is required");
    }
    // Get cached lookups
    const [acctCache, deptCache, classCacheData, vendorCacheData] = await Promise.all([
        getAccountCache(client),
        getDepartmentCache(client),
        getClassCache(client),
        getVendorCache(client),
    ]);
    // Resolve vendor
    const resolveVendorRef = (nameOrId) => {
        const byId = vendorCacheData.byId.get(nameOrId);
        if (byId)
            return { value: byId.Id, name: byId.DisplayName };
        const byName = vendorCacheData.byName.get(nameOrId.toLowerCase());
        if (byName)
            return { value: byName.Id, name: byName.DisplayName };
        const byPartial = vendorCacheData.items.find(v => v.DisplayName.toLowerCase().includes(nameOrId.toLowerCase()));
        if (byPartial)
            return { value: byPartial.Id, name: byPartial.DisplayName };
        throw new Error(`Vendor not found: "${nameOrId}"`);
    };
    let vendorRef;
    if (vendor_id) {
        vendorRef = resolveVendorRef(vendor_id);
    }
    else if (vendor_name) {
        vendorRef = resolveVendorRef(vendor_name);
    }
    else {
        throw new Error("Either vendor_name or vendor_id is required");
    }
    // Resolve account refs
    const lookupAccount = (name) => {
        let match = acctCache.byAcctNum.get(name.toLowerCase());
        if (!match)
            match = acctCache.byName.get(name.toLowerCase());
        if (!match)
            match = acctCache.items.find(a => a.FullyQualifiedName?.toLowerCase().includes(name.toLowerCase()));
        if (match)
            return { id: match.Id, name: match.FullyQualifiedName || match.Name, acctNum: match.AcctNum };
        throw new Error(`Account not found: "${name}"`);
    };
    // Resolve department (header-level)
    let departmentRef;
    const deptInput = department_id || department_name;
    if (deptInput) {
        const byId = deptCache.byId.get(deptInput);
        if (byId) {
            departmentRef = { value: byId.Id, name: byId.FullyQualifiedName || byId.Name };
        }
        else {
            const byName = deptCache.byName.get(deptInput.toLowerCase());
            if (byName) {
                departmentRef = { value: byName.Id, name: byName.FullyQualifiedName || byName.Name };
            }
            else {
                const byPartial = deptCache.items.find(d => d.FullyQualifiedName?.toLowerCase().includes(deptInput.toLowerCase()));
                if (byPartial) {
                    departmentRef = { value: byPartial.Id, name: byPartial.FullyQualifiedName || byPartial.Name };
                }
                else {
                    throw new Error(`Department not found: "${deptInput}"`);
                }
            }
        }
    }
    // Resolve class (header-level)
    let classRef;
    if (class_name) {
        const byId = classCacheData.byId.get(class_name);
        if (byId) {
            classRef = { value: byId.Id, name: byId.FullyQualifiedName || byId.Name };
        }
        else {
            const byName = classCacheData.byName.get(class_name.toLowerCase());
            if (byName) {
                classRef = { value: byName.Id, name: byName.FullyQualifiedName || byName.Name };
            }
            else {
                const byPartial = classCacheData.items.find(c => c.FullyQualifiedName?.toLowerCase().includes(class_name.toLowerCase()));
                if (byPartial) {
                    classRef = { value: byPartial.Id, name: byPartial.FullyQualifiedName || byPartial.Name };
                }
                else {
                    throw new Error(`Class not found: "${class_name}"`);
                }
            }
        }
    }
    // Resolve AP account if specified
    let apAccountRef;
    if (ap_account) {
        const acct = lookupAccount(ap_account);
        apAccountRef = { value: acct.id, name: acct.name };
    }
    // Resolve lines
    const resolvedLines = lines.map((line) => {
        let accountId = line.account_id;
        let accountName = line.account_name;
        let accountNum;
        if (!accountId && accountName) {
            const account = lookupAccount(accountName);
            accountId = account.id;
            accountName = account.name;
            accountNum = account.acctNum;
        }
        else if (!accountId && !accountName) {
            throw new Error("Each line must have either account_id or account_name");
        }
        const amountCents = validateAmount(line.amount, `Line ${accountName || accountId}`);
        return {
            ...line,
            account_id: accountId,
            account_name: accountName,
            account_num: accountNum,
            amount_cents: amountCents,
            amount: toDollars(amountCents),
        };
    });
    // Calculate total
    const totalCents = sumCents(resolvedLines.map(l => l.amount_cents));
    // Build QuickBooks Bill object
    const billObject = {
        VendorRef: vendorRef,
        TxnDate: txn_date,
        ...(due_date && { DueDate: due_date }),
        ...(memo && { PrivateNote: memo }),
        ...(doc_number && { DocNumber: doc_number }),
        ...(departmentRef && { DepartmentRef: departmentRef }),
        ...(classRef && { ClassRef: classRef }),
        ...(apAccountRef && { APAccountRef: apAccountRef }),
        Line: resolvedLines.map((line) => ({
            Amount: line.amount,
            DetailType: "AccountBasedExpenseLineDetail",
            ...(line.description && { Description: line.description }),
            AccountBasedExpenseLineDetail: {
                AccountRef: {
                    value: line.account_id,
                    name: line.account_name,
                },
                BillableStatus: "NotBillable",
            },
        })),
    };
    if (draft) {
        const formatAccount = (l) => {
            const num = l.account_num ? `${l.account_num} ` : "";
            return `${num}${l.account_name || l.account_id}`;
        };
        const preview = [
            "DRAFT - Bill Preview",
            "",
            `Vendor: ${vendorRef.name}`,
            `Date: ${txn_date}`,
            `Due Date: ${due_date || "(none)"}`,
            `Ref no.: ${doc_number || "(auto-assign)"}`,
            `Department: ${departmentRef?.name || "(none)"}`,
            `Class: ${classRef?.name || "(none)"}`,
            `AP Account: ${apAccountRef?.name || "(default)"}`,
            `Memo: ${memo || "(none)"}`,
            `Total: $${formatDollars(totalCents)}`,
            "",
            "Lines:",
            ...resolvedLines.map(l => `  ${formatAccount(l)}: $${l.amount.toFixed(2)}${l.description ? ` "${l.description}"` : ""}`),
            "",
            "Set draft=false to create this bill.",
        ].join("\n");
        return {
            content: [{ type: "text", text: preview }],
        };
    }
    // Create the bill
    const result = await promisify((cb) => client.createBill(billObject, cb));
    const qboUrl = `https://app.qbo.intuit.com/app/bill?txnId=${result.Id}`;
    const response = [
        "Bill Created!",
        "",
        `Vendor: ${vendorRef.name}`,
        `Ref no.: ${result.DocNumber || "(auto-assigned)"}`,
        `Date: ${txn_date}`,
        `Total: $${formatDollars(totalCents)}`,
        "",
        `View in QuickBooks: ${qboUrl}`,
    ].join("\n");
    return {
        content: [{ type: "text", text: response }],
    };
}
export async function handleGetBill(client, args) {
    const { id } = args;
    const bill = await promisify((cb) => client.getBill(id, cb));
    const qboUrl = `https://app.qbo.intuit.com/app/bill?txnId=${bill.Id}`;
    // Format summary
    const lines = [
        'Bill',
        '====',
        `ID: ${bill.Id}`,
        `SyncToken: ${bill.SyncToken}`,
        `Vendor: ${bill.VendorRef?.name || bill.VendorRef?.value || '(none)'}`,
        `Date: ${bill.TxnDate}`,
        `Due Date: ${bill.DueDate || '(none)'}`,
        `Ref no.: ${bill.DocNumber || '(none)'}`,
        `Memo: ${bill.PrivateNote || '(none)'}`,
        `AP Account: ${bill.APAccountRef?.name || bill.APAccountRef?.value || 'Accounts Payable'}`,
        `Class: ${bill.ClassRef?.name || bill.ClassRef?.value || '(none)'}`,
        `Total: $${(bill.TotalAmt || 0).toFixed(2)}`,
        '',
        'Lines:',
    ];
    for (const line of bill.Line || []) {
        if (line.AccountBasedExpenseLineDetail) {
            const detail = line.AccountBasedExpenseLineDetail;
            const acctName = detail.AccountRef.name || detail.AccountRef.value;
            const deptStr = detail.DepartmentRef?.name ? ` [${detail.DepartmentRef.name}]` : '';
            const descStr = line.Description ? ` "${line.Description}"` : '';
            lines.push(`  Line ${line.Id}: ${acctName}${deptStr} $${line.Amount.toFixed(2)}${descStr}`);
        }
        else if (line.ItemBasedExpenseLineDetail) {
            const detail = line.ItemBasedExpenseLineDetail;
            const itemName = detail.ItemRef.name || detail.ItemRef.value;
            const descStr = line.Description ? ` "${line.Description}"` : '';
            lines.push(`  Line ${line.Id}: Item: ${itemName} (Qty: ${detail.Qty || 1}) $${line.Amount.toFixed(2)}${descStr}`);
        }
    }
    lines.push('');
    lines.push(`View in QuickBooks: ${qboUrl}`);
    return outputReport(`bill-${bill.Id}`, bill, lines.join('\n'));
}
export async function handleEditBill(client, args) {
    const { id, vendor_name, txn_date, due_date, memo, department_name, class_name, doc_number, lines: lineChanges, draft = true } = args;
    // Fetch current Bill
    const current = await promisify((cb) => client.getBill(id, cb));
    // Resolve vendor if changing
    const vendorRef = vendor_name
        ? await resolveVendor(client, vendor_name)
        : current.VendorRef;
    // Determine if we're modifying lines - requires full update (not sparse)
    const needsFullUpdate = lineChanges && lineChanges.length > 0;
    // Build updated Bill
    // Note: VendorRef is required by QB API even for sparse updates
    const updated = {
        Id: current.Id,
        SyncToken: current.SyncToken,
        VendorRef: vendorRef,
    };
    // Only use sparse for non-line updates; full update needed for line modifications
    // Note: node-quickbooks auto-sets sparse=true, so we must explicitly set sparse=false for full updates
    if (!needsFullUpdate) {
        updated.sparse = true;
    }
    else {
        // Full update: explicitly set sparse=false (node-quickbooks defaults to true)
        updated.sparse = false;
        updated.TxnDate = current.TxnDate;
        updated.DueDate = current.DueDate;
        updated.DocNumber = current.DocNumber;
        updated.PrivateNote = current.PrivateNote;
        if (current.DepartmentRef) {
            updated.DepartmentRef = current.DepartmentRef;
        }
        if (current.ClassRef) {
            updated.ClassRef = current.ClassRef;
        }
        // Copy lines and strip read-only fields
        updated.Line = current.Line.map(line => {
            const { LineNum, ...rest } = line;
            return rest;
        });
    }
    if (txn_date !== undefined)
        updated.TxnDate = txn_date;
    if (due_date !== undefined)
        updated.DueDate = due_date;
    if (memo !== undefined)
        updated.PrivateNote = memo;
    if (doc_number !== undefined)
        updated.DocNumber = doc_number;
    // Resolve department if changing
    if (department_name !== undefined) {
        const deptCache = await getDepartmentCache(client);
        let match = deptCache.byName.get(department_name.toLowerCase());
        if (!match)
            match = deptCache.items.find(d => d.FullyQualifiedName?.toLowerCase().includes(department_name.toLowerCase()));
        if (!match)
            throw new Error(`Department not found: "${department_name}"`);
        updated.DepartmentRef = { value: match.Id, name: match.FullyQualifiedName || match.Name };
    }
    // Resolve class if changing
    if (class_name !== undefined) {
        const classCache = await getClassCache(client);
        let match = classCache.byName.get(class_name.toLowerCase());
        if (!match)
            match = classCache.items.find(c => c.FullyQualifiedName?.toLowerCase().includes(class_name.toLowerCase()));
        if (!match)
            throw new Error(`Class not found: "${class_name}"`);
        updated.ClassRef = { value: match.Id, name: match.FullyQualifiedName || match.Name };
    }
    // Process line changes if provided
    // Use updated.Line if available (for full updates with stripped read-only fields), else current.Line
    let finalLines = [...(updated.Line || current.Line)];
    if (lineChanges && lineChanges.length > 0) {
        const acctCache = await getAccountCache(client);
        const resolveAcct = (name) => {
            let match = acctCache.byAcctNum.get(name.toLowerCase());
            if (!match)
                match = acctCache.byName.get(name.toLowerCase());
            if (!match)
                match = acctCache.items.find(a => a.FullyQualifiedName?.toLowerCase().includes(name.toLowerCase()));
            if (!match)
                throw new Error(`Account not found: "${name}"`);
            return { value: match.Id, name: match.FullyQualifiedName || match.Name };
        };
        for (const change of lineChanges) {
            if (change.line_id) {
                const lineIndex = finalLines.findIndex(l => l.Id === change.line_id);
                if (lineIndex === -1) {
                    throw new Error(`Line ID ${change.line_id} not found in bill`);
                }
                if (change.delete) {
                    finalLines.splice(lineIndex, 1);
                }
                else {
                    const line = { ...finalLines[lineIndex] };
                    const detail = { ...(line.AccountBasedExpenseLineDetail || {}) };
                    if (change.amount !== undefined) {
                        const amountCents = validateAmount(change.amount, `Line ${change.line_id}`);
                        line.Amount = toDollars(amountCents);
                    }
                    if (change.description !== undefined)
                        line.Description = change.description;
                    if (change.account_name !== undefined)
                        detail.AccountRef = resolveAcct(change.account_name);
                    line.AccountBasedExpenseLineDetail = detail;
                    line.DetailType = 'AccountBasedExpenseLineDetail';
                    finalLines[lineIndex] = line;
                }
            }
            else {
                if (!change.amount || !change.account_name) {
                    throw new Error('New lines require amount and account_name');
                }
                // Validate and normalize the amount
                const amountCents = validateAmount(change.amount, `New line for ${change.account_name}`);
                // Id omitted for new lines - QB will assign
                const newLine = {
                    Amount: toDollars(amountCents),
                    Description: change.description,
                    DetailType: 'AccountBasedExpenseLineDetail',
                    AccountBasedExpenseLineDetail: {
                        AccountRef: resolveAcct(change.account_name),
                    }
                };
                finalLines.push(newLine);
            }
        }
        updated.Line = finalLines;
    }
    const qboUrl = `https://app.qbo.intuit.com/app/bill?txnId=${id}`;
    if (draft) {
        const previewLines = [
            'DRAFT - Bill Edit Preview',
            '',
            `ID: ${id}`,
            `SyncToken: ${current.SyncToken}`,
            '',
            'Changes:',
        ];
        if (vendor_name)
            previewLines.push(`  Vendor: ${current.VendorRef?.name || current.VendorRef?.value} → ${vendorRef.name || vendor_name}`);
        if (txn_date !== undefined)
            previewLines.push(`  Date: ${current.TxnDate} → ${txn_date}`);
        if (due_date !== undefined)
            previewLines.push(`  Due Date: ${current.DueDate || '(none)'} → ${due_date}`);
        if (memo !== undefined)
            previewLines.push(`  Memo: ${current.PrivateNote || '(none)'} → ${memo}`);
        if (doc_number !== undefined)
            previewLines.push(`  Ref no.: ${current.DocNumber || '(none)'} → ${doc_number}`);
        if (department_name !== undefined)
            previewLines.push(`  Department: ${current.DepartmentRef?.name || '(none)'} → ${updated.DepartmentRef?.name || department_name}`);
        if (class_name !== undefined)
            previewLines.push(`  Class: ${current.ClassRef?.name || '(none)'} → ${updated.ClassRef?.name || class_name}`);
        if (updated.Line) {
            previewLines.push('');
            previewLines.push('Updated Lines:');
            for (const line of updated.Line) {
                const detail = line.AccountBasedExpenseLineDetail;
                if (detail) {
                    const acctName = detail.AccountRef.name || detail.AccountRef.value;
                    const deptStr = detail.DepartmentRef?.name ? ` [${detail.DepartmentRef.name}]` : '';
                    previewLines.push(`  ${acctName}${deptStr}: $${line.Amount.toFixed(2)}`);
                }
            }
        }
        previewLines.push('');
        previewLines.push('Set draft=false to apply these changes.');
        return {
            content: [{ type: "text", text: previewLines.join('\n') }],
        };
    }
    const result = await promisify((cb) => client.updateBill(updated, cb));
    return {
        content: [{ type: "text", text: `Bill ${id} updated successfully.\nNew SyncToken: ${result.SyncToken}\nView in QuickBooks: ${qboUrl}` }],
    };
}
//# sourceMappingURL=bill.js.map