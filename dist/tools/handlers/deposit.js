// Handlers for deposit tools (create, get, edit)
import { promisify, getAccountCache, getDepartmentCache, getVendorCache, } from "../../client/index.js";
import { validateAmount, toDollars, formatDollars, toCents, sumCents, outputReport } from "../../utils/index.js";
// --- Shared resolution helpers ---
function resolveAccountRef(acctCache, name) {
    let match = acctCache.byAcctNum.get(name.toLowerCase());
    if (!match)
        match = acctCache.byName.get(name.toLowerCase());
    if (!match)
        match = acctCache.items.find(a => a.FullyQualifiedName?.toLowerCase().includes(name.toLowerCase()));
    if (!match)
        throw new Error(`Account not found: "${name}"`);
    return { value: match.Id, name: match.FullyQualifiedName || match.Name };
}
function resolveDepartmentRef(deptCache, nameOrId) {
    const byId = deptCache.byId.get(nameOrId);
    if (byId)
        return { value: byId.Id, name: byId.FullyQualifiedName || byId.Name };
    let match = deptCache.byName.get(nameOrId.toLowerCase());
    if (!match)
        match = deptCache.items.find(d => d.FullyQualifiedName?.toLowerCase().includes(nameOrId.toLowerCase()));
    if (!match)
        throw new Error(`Department not found: "${nameOrId}"`);
    return { value: match.Id, name: match.FullyQualifiedName || match.Name };
}
function resolveEntityRef(vendorCache, nameOrId) {
    const byId = vendorCache.byId.get(nameOrId);
    if (byId)
        return { value: byId.Id, name: byId.DisplayName, type: "VENDOR" };
    const byName = vendorCache.byName.get(nameOrId.toLowerCase());
    if (byName)
        return { value: byName.Id, name: byName.DisplayName, type: "VENDOR" };
    const byPartial = vendorCache.items.find(v => v.DisplayName.toLowerCase().includes(nameOrId.toLowerCase()));
    if (byPartial)
        return { value: byPartial.Id, name: byPartial.DisplayName, type: "VENDOR" };
    throw new Error(`Vendor not found: "${nameOrId}"`);
}
// --- Handlers ---
export async function handleCreateDeposit(client, args) {
    const { deposit_to_account, txn_date, lines, department_name, department_id, memo, draft = true, } = args;
    if (!lines || lines.length === 0) {
        throw new Error("At least one line is required");
    }
    // Parallel cache fetch
    const [acctCache, deptCache, vendorCacheData] = await Promise.all([
        getAccountCache(client),
        getDepartmentCache(client),
        getVendorCache(client),
    ]);
    // Resolve deposit_to_account
    const depositToRef = resolveAccountRef(acctCache, deposit_to_account);
    // Resolve header-level department
    let departmentRef;
    const deptInput = department_id || department_name;
    if (deptInput) {
        departmentRef = resolveDepartmentRef(deptCache, deptInput);
    }
    // Resolve lines
    const resolvedLines = lines.map((line, i) => {
        const label = `Line ${i + 1}`;
        // Resolve account
        let accountRef;
        if (line.account_id) {
            const byId = acctCache.byId.get(line.account_id);
            if (byId) {
                accountRef = { value: byId.Id, name: byId.FullyQualifiedName || byId.Name };
            }
            else {
                throw new Error(`${label}: Account ID not found: "${line.account_id}"`);
            }
        }
        else if (line.account_name) {
            accountRef = resolveAccountRef(acctCache, line.account_name);
        }
        else {
            throw new Error(`${label}: Either account_name or account_id is required`);
        }
        // Validate amount
        const amountCents = validateAmount(line.amount, label);
        // Resolve entity if provided
        let entityRef;
        if (line.entity_id) {
            entityRef = resolveEntityRef(vendorCacheData, line.entity_id);
        }
        else if (line.entity_name) {
            entityRef = resolveEntityRef(vendorCacheData, line.entity_name);
        }
        return {
            accountRef,
            amountCents,
            amount: toDollars(amountCents),
            description: line.description,
            entityRef,
        };
    });
    // Calculate total for display
    const totalCents = sumCents(resolvedLines.map(l => l.amountCents));
    // Build QB deposit object
    const depositObject = {
        DepositToAccountRef: depositToRef,
        TxnDate: txn_date,
        ...(departmentRef && { DepartmentRef: departmentRef }),
        ...(memo && { PrivateNote: memo }),
        Line: resolvedLines.map(line => {
            const depositLineDetail = {
                AccountRef: line.accountRef,
            };
            if (line.entityRef) {
                depositLineDetail.Entity = line.entityRef;
            }
            return {
                Amount: line.amount,
                DetailType: "DepositLineDetail",
                ...(line.description && { Description: line.description }),
                DepositLineDetail: depositLineDetail,
            };
        }),
    };
    if (draft) {
        const preview = [
            "DRAFT - Deposit Preview",
            "",
            `Date: ${txn_date}`,
            `Deposit To: ${depositToRef.name}`,
            `Department: ${departmentRef?.name || "(none)"}`,
            `Memo: ${memo || "(none)"}`,
            "",
            "Lines:",
            ...resolvedLines.map(l => {
                const entityStr = l.entityRef ? ` [${l.entityRef.name}]` : "";
                const descStr = l.description ? ` "${l.description}"` : "";
                return `  ${l.accountRef.name}: $${l.amount.toFixed(2)}${entityStr}${descStr}`;
            }),
            "  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
            `  Total: $${formatDollars(totalCents)}`,
            "",
            "Set draft=false to create this deposit.",
        ].join("\n");
        return {
            content: [{ type: "text", text: preview }],
        };
    }
    // Create the deposit
    const result = await promisify((cb) => client.createDeposit(depositObject, cb));
    const qboUrl = `https://app.qbo.intuit.com/app/deposit?txnId=${result.Id}`;
    const response = [
        "Deposit Created!",
        "",
        `ID: ${result.Id}`,
        `Date: ${txn_date}`,
        `Deposit To: ${depositToRef.name}`,
        `Department: ${departmentRef?.name || "(none)"}`,
        `Total: $${formatDollars(totalCents)}`,
        "",
        `View in QuickBooks: ${qboUrl}`,
    ].join("\n");
    return {
        content: [{ type: "text", text: response }],
    };
}
export async function handleGetDeposit(client, args) {
    const { id } = args;
    const deposit = await promisify((cb) => client.getDeposit(id, cb));
    const qboUrl = `https://app.qbo.intuit.com/app/deposit?txnId=${deposit.Id}`;
    // Format summary
    const lines = [
        'Deposit',
        '=======',
        `ID: ${deposit.Id}`,
        `SyncToken: ${deposit.SyncToken}`,
        `Date: ${deposit.TxnDate}`,
        `Deposit To: ${deposit.DepositToAccountRef?.name || deposit.DepositToAccountRef?.value || '(default)'}`,
        `Department: ${deposit.DepartmentRef?.name || deposit.DepartmentRef?.value || '(none)'}`,
        `Memo: ${deposit.PrivateNote || '(none)'}`,
        `Total: $${(deposit.TotalAmt || 0).toFixed(2)}`,
        '',
        'Lines:',
    ];
    for (const line of deposit.Line || []) {
        if (line.DepositLineDetail) {
            const detail = line.DepositLineDetail;
            const acctName = detail.AccountRef?.name || detail.AccountRef?.value || '(no account)';
            const entityStr = detail.Entity?.name
                ? ` from ${detail.Entity.type || 'Entity'}: ${detail.Entity.name}`
                : '';
            const deptStr = detail.ClassRef?.name ? ` [${detail.ClassRef.name}]` : '';
            const descStr = line.Description ? ` "${line.Description}"` : '';
            lines.push(`  Line ${line.Id}: ${acctName} $${line.Amount.toFixed(2)}${entityStr}${deptStr}${descStr}`);
        }
    }
    lines.push('');
    lines.push(`View in QuickBooks: ${qboUrl}`);
    return outputReport(`deposit-${deposit.Id}`, deposit, lines.join('\n'));
}
export async function handleEditDeposit(client, args) {
    const { id, txn_date, memo, deposit_to_account, department_name, lines: newLines, draft = true, expected_total } = args;
    // Fetch current Deposit
    const current = await promisify((cb) => client.getDeposit(id, cb));
    // Determine if we're replacing lines - requires full update (not sparse)
    const needsFullUpdate = newLines && newLines.length > 0;
    // Build updated Deposit
    let updated;
    // Only use sparse for non-line updates; full update needed for line modifications
    // Note: node-quickbooks auto-sets sparse=true, so we must explicitly set sparse=false for full updates
    if (!needsFullUpdate) {
        updated = {
            Id: current.Id,
            SyncToken: current.SyncToken,
            sparse: true,
        };
        // DepositToAccountRef is required for sparse updates
        if (current.DepositToAccountRef) {
            updated.DepositToAccountRef = current.DepositToAccountRef;
        }
    }
    else {
        // Full update: explicitly set sparse=false and copy only needed fields
        // (same pattern as journal-entry.ts which works for line deletion)
        updated = {
            Id: current.Id,
            SyncToken: current.SyncToken,
            sparse: false,
            TxnDate: current.TxnDate,
            PrivateNote: current.PrivateNote,
        };
        if (current.DepositToAccountRef) {
            updated.DepositToAccountRef = current.DepositToAccountRef;
        }
        if (current.DepartmentRef) {
            updated.DepartmentRef = current.DepartmentRef;
        }
        if (current.CurrencyRef) {
            updated.CurrencyRef = current.CurrencyRef;
        }
        // Copy lines and strip read-only fields
        updated.Line = (current.Line || []).map(line => {
            const { LineNum, CustomExtensions, ...rest } = line;
            return rest;
        });
    }
    if (txn_date !== undefined)
        updated.TxnDate = txn_date;
    if (memo !== undefined)
        updated.PrivateNote = memo;
    // Fetch caches when needed for header-level resolution or line processing
    const needsAcctCache = deposit_to_account !== undefined || (newLines && newLines.length > 0);
    const needsDeptCache = department_name !== undefined;
    const [acctCache, deptCache] = await Promise.all([
        needsAcctCache ? getAccountCache(client) : Promise.resolve(null),
        needsDeptCache ? getDepartmentCache(client) : Promise.resolve(null),
    ]);
    // Resolve deposit_to_account if provided
    if (deposit_to_account !== undefined) {
        const ref = resolveAccountRef(acctCache, deposit_to_account);
        updated.DepositToAccountRef = ref;
    }
    // Resolve header-level department if provided
    if (department_name !== undefined) {
        const ref = resolveDepartmentRef(deptCache, department_name);
        updated.DepartmentRef = ref;
    }
    // Process full line replacement if provided
    // QB API does not support deleting individual deposit lines, so we do full replacement
    // The new lines must sum to the same total as the original deposit (bank amount cannot change)
    if (newLines && newLines.length > 0) {
        // Build new lines array (full replacement)
        // If line_id is provided, find existing line and update it (preserves Entity ref)
        // If line_id is not provided, create a new line
        const currentLines = current.Line || [];
        const currentLinesById = new Map(currentLines.map(l => [l.Id, l]));
        const finalLines = [];
        const lineCents = [];
        for (let i = 0; i < newLines.length; i++) {
            const input = newLines[i];
            const amountCents = validateAmount(input.amount, `Line ${i + 1}`);
            lineCents.push(amountCents);
            let line;
            if (input.line_id) {
                // Update existing line - preserve Entity ref
                const existing = currentLinesById.get(input.line_id);
                if (!existing) {
                    throw new Error(`Line ID ${input.line_id} not found in deposit`);
                }
                // Clone the existing line to preserve Entity (strip read-only fields)
                const existingAny = existing;
                const { LineNum, CustomExtensions, ...rest } = existingAny;
                line = rest;
                line.Amount = toDollars(amountCents);
                line.DepositLineDetail = {
                    ...line.DepositLineDetail,
                    AccountRef: resolveAccountRef(acctCache, input.account_name),
                };
            }
            else {
                // Create new line
                line = {
                    Amount: toDollars(amountCents),
                    DetailType: 'DepositLineDetail',
                    DepositLineDetail: {
                        AccountRef: resolveAccountRef(acctCache, input.account_name),
                    },
                };
            }
            if (input.description !== undefined) {
                line.Description = input.description;
            }
            finalLines.push(line);
        }
        // Validate that new total matches expected total
        // Use expected_total if provided (for fixing corrupted deposits), otherwise use current total
        const targetTotalCents = expected_total !== undefined
            ? validateAmount(expected_total, "expected_total")
            : toCents(current.TotalAmt || 0);
        const newTotalCents = sumCents(lineCents);
        if (newTotalCents !== targetTotalCents) {
            const diff = toDollars(newTotalCents - targetTotalCents);
            const targetLabel = expected_total !== undefined ? "expected" : "original deposit";
            throw new Error(`Line amounts must sum to the ${targetLabel} total. ` +
                `Target: $${toDollars(targetTotalCents).toFixed(2)}, ` +
                `New total: $${toDollars(newTotalCents).toFixed(2)} ` +
                `(difference: $${diff >= 0 ? '+' : ''}${diff.toFixed(2)}). ` +
                (expected_total === undefined ? `The bank deposit amount cannot change.` : ''));
        }
        updated.Line = finalLines;
    }
    const qboUrl = `https://app.qbo.intuit.com/app/deposit?txnId=${id}`;
    if (draft) {
        const previewLines = [
            'DRAFT - Deposit Edit Preview',
            '',
            `ID: ${id}`,
            `SyncToken: ${current.SyncToken}`,
            '',
            'Changes:',
        ];
        if (txn_date !== undefined)
            previewLines.push(`  Date: ${current.TxnDate} \u2192 ${txn_date}`);
        if (memo !== undefined)
            previewLines.push(`  Memo: ${current.PrivateNote || '(none)'} \u2192 ${memo}`);
        if (deposit_to_account !== undefined) {
            const newAcct = updated.DepositToAccountRef?.name || deposit_to_account;
            previewLines.push(`  Deposit To: ${current.DepositToAccountRef?.name || '(default)'} \u2192 ${newAcct}`);
        }
        if (department_name !== undefined) {
            const newDept = updated.DepartmentRef?.name || department_name;
            previewLines.push(`  Department: ${current.DepartmentRef?.name || '(none)'} \u2192 ${newDept}`);
        }
        if (updated.Line) {
            previewLines.push('');
            previewLines.push(`New Lines (replacing ${current.Line?.length || 0} existing lines):`);
            let lineTotal = 0;
            for (const line of updated.Line) {
                const detail = line.DepositLineDetail;
                if (detail) {
                    const acctName = detail.AccountRef?.name || detail.AccountRef?.value || '(account)';
                    const deptStr = detail.ClassRef?.name ? ` [${detail.ClassRef.name}]` : '';
                    const descStr = line.Description ? ` "${line.Description}"` : '';
                    previewLines.push(`  ${acctName}: $${line.Amount.toFixed(2)}${deptStr}${descStr}`);
                    lineTotal += line.Amount;
                }
            }
            previewLines.push(`  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`);
            if (expected_total !== undefined) {
                previewLines.push(`  Total: $${lineTotal.toFixed(2)} (expected: $${expected_total.toFixed(2)}, current: $${(current.TotalAmt || 0).toFixed(2)})`);
            }
            else {
                previewLines.push(`  Total: $${lineTotal.toFixed(2)} (must equal original: $${(current.TotalAmt || 0).toFixed(2)})`);
            }
        }
        previewLines.push('');
        previewLines.push('Set draft=false to apply these changes.');
        return {
            content: [{ type: "text", text: previewLines.join('\n') }],
        };
    }
    const result = await promisify((cb) => client.updateDeposit(updated, cb));
    return {
        content: [{ type: "text", text: `Deposit ${id} updated successfully.\nNew SyncToken: ${result.SyncToken}\nView in QuickBooks: ${qboUrl}` }],
    };
}
//# sourceMappingURL=deposit.js.map