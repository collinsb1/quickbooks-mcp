// Handlers for vendor credit tools (create, get, edit)
import { promisify, getAccountCache, getDepartmentCache, getClassCache, getVendorCache, } from "../../client/index.js";
import { validateAmount, toDollars, formatDollars, sumCents, outputReport } from "../../utils/index.js";
export async function handleCreateVendorCredit(client, args) {
    const { vendor_name, vendor_id, txn_date, department_name, department_id, class_name, ap_account, memo, doc_number, lines, draft = true, } = args;
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
    // Resolve class (header-level, optional)
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
    // Build QuickBooks VendorCredit object
    const vcObject = {
        VendorRef: vendorRef,
        TxnDate: txn_date,
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
            "DRAFT - Vendor Credit Preview",
            "",
            `Vendor: ${vendorRef.name}`,
            `Date: ${txn_date}`,
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
            "Set draft=false to create this vendor credit.",
        ].join("\n");
        return {
            content: [{ type: "text", text: preview }],
        };
    }
    // Create the vendor credit
    const result = await promisify((cb) => client.createVendorCredit(vcObject, cb));
    const qboUrl = `https://app.qbo.intuit.com/app/vendorcredit?txnId=${result.Id}`;
    const response = [
        "Vendor Credit Created!",
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
export async function handleGetVendorCredit(client, args) {
    const { id } = args;
    const vc = await promisify((cb) => client.getVendorCredit(id, cb));
    const qboUrl = `https://app.qbo.intuit.com/app/vendorcredit?txnId=${vc.Id}`;
    // Format summary
    const lines = [
        'Vendor Credit',
        '=============',
        `ID: ${vc.Id}`,
        `SyncToken: ${vc.SyncToken}`,
        `Vendor: ${vc.VendorRef?.name || vc.VendorRef?.value || '(none)'}`,
        `Date: ${vc.TxnDate}`,
        `Ref no.: ${vc.DocNumber || '(none)'}`,
        `Memo: ${vc.PrivateNote || '(none)'}`,
        `AP Account: ${vc.APAccountRef?.name || vc.APAccountRef?.value || 'Accounts Payable'}`,
        `Department: ${vc.DepartmentRef?.name || vc.DepartmentRef?.value || '(none)'}`,
        `Class: ${vc.ClassRef?.name || vc.ClassRef?.value || '(none)'}`,
        `Total: $${(vc.TotalAmt || 0).toFixed(2)}`,
        '',
        'Lines:',
    ];
    for (const line of vc.Line || []) {
        if (line.AccountBasedExpenseLineDetail) {
            const detail = line.AccountBasedExpenseLineDetail;
            const acctName = detail.AccountRef.name || detail.AccountRef.value;
            const deptStr = detail.DepartmentRef?.name ? ` [${detail.DepartmentRef.name}]` : '';
            const descStr = line.Description ? ` "${line.Description}"` : '';
            lines.push(`  Line ${line.Id}: ${acctName}${deptStr} $${line.Amount.toFixed(2)}${descStr}`);
        }
    }
    lines.push('');
    lines.push(`View in QuickBooks: ${qboUrl}`);
    return outputReport(`vendor-credit-${vc.Id}`, vc, lines.join('\n'));
}
export async function handleEditVendorCredit(client, args) {
    const { id, vendor_name, txn_date, memo, doc_number, class_name, lines: lineChanges, draft = true } = args;
    // Fetch current VendorCredit
    const current = await promisify((cb) => client.getVendorCredit(id, cb));
    // Determine if we're modifying lines - requires full update (not sparse)
    const needsFullUpdate = lineChanges && lineChanges.length > 0;
    // Build updated VendorCredit
    // Note: VendorRef is required by QB API even for sparse updates
    let vendorRef = current.VendorRef;
    const updated = {
        Id: current.Id,
        SyncToken: current.SyncToken,
        VendorRef: vendorRef,
    };
    if (!needsFullUpdate) {
        updated.sparse = true;
    }
    else {
        updated.sparse = false;
        updated.TxnDate = current.TxnDate;
        updated.PrivateNote = current.PrivateNote;
        updated.DocNumber = current.DocNumber;
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
    // Resolve vendor if changing
    if (vendor_name) {
        const vendorCacheData = await getVendorCache(client);
        const byName = vendorCacheData.byName.get(vendor_name.toLowerCase());
        if (byName) {
            vendorRef = { value: byName.Id, name: byName.DisplayName };
        }
        else {
            const byPartial = vendorCacheData.items.find(v => v.DisplayName.toLowerCase().includes(vendor_name.toLowerCase()));
            if (byPartial) {
                vendorRef = { value: byPartial.Id, name: byPartial.DisplayName };
            }
            else {
                throw new Error(`Vendor not found: "${vendor_name}"`);
            }
        }
        updated.VendorRef = vendorRef;
    }
    if (txn_date !== undefined)
        updated.TxnDate = txn_date;
    if (memo !== undefined)
        updated.PrivateNote = memo;
    if (doc_number !== undefined)
        updated.DocNumber = doc_number;
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
                    throw new Error(`Line ID ${change.line_id} not found in vendor credit`);
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
                const amountCents = validateAmount(change.amount, `New line for ${change.account_name}`);
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
    const qboUrl = `https://app.qbo.intuit.com/app/vendorcredit?txnId=${id}`;
    if (draft) {
        const previewLines = [
            'DRAFT - Vendor Credit Edit Preview',
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
        if (memo !== undefined)
            previewLines.push(`  Memo: ${current.PrivateNote || '(none)'} → ${memo}`);
        if (doc_number !== undefined)
            previewLines.push(`  Ref no.: ${current.DocNumber || '(none)'} → ${doc_number}`);
        if (class_name !== undefined) {
            const newClass = updated.ClassRef?.name || class_name;
            previewLines.push(`  Class: ${current.ClassRef?.name || '(none)'} → ${newClass}`);
        }
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
    const result = await promisify((cb) => client.updateVendorCredit(updated, cb));
    return {
        content: [{ type: "text", text: `Vendor Credit ${id} updated successfully.\nNew SyncToken: ${result.SyncToken}\nView in QuickBooks: ${qboUrl}` }],
    };
}
//# sourceMappingURL=vendor-credit.js.map