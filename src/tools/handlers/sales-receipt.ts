// Handlers for sales receipt tools (get, edit)

import QuickBooks from "node-quickbooks";
import {
  promisify,
  getDepartmentCache,
} from "../../client/index.js";
import { writeReport, validateAmount, toDollars } from "../../utils/index.js";

interface SalesReceiptLineChange {
  line_id?: string;
  amount?: number;
  description?: string;
  department_name?: string;
  delete?: boolean;
}

export async function handleGetSalesReceipt(
  client: QuickBooks,
  args: { id: string }
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { id } = args;

  const salesReceipt = await promisify<unknown>((cb) =>
    client.getSalesReceipt(id, cb)
  ) as {
    Id: string;
    SyncToken: string;
    TxnDate: string;
    DocNumber?: string;
    PrivateNote?: string;
    TotalAmt?: number;
    CustomerRef?: { value: string; name?: string };
    DepositToAccountRef?: { value: string; name?: string };
    DepartmentRef?: { value: string; name?: string };
    Line?: Array<{
      Id: string;
      Amount: number;
      Description?: string;
      DetailType: string;
      SalesItemLineDetail?: {
        ItemRef: { value: string; name?: string };
        Qty?: number;
        UnitPrice?: number;
        ItemAccountRef?: { value: string; name?: string };
        ClassRef?: { value: string; name?: string };
        TaxCodeRef?: { value: string; name?: string };
      };
    }>;
  };
  const qboUrl = `https://app.qbo.intuit.com/app/salesreceipt?txnId=${salesReceipt.Id}`;

  // Write full object to file
  const filepath = writeReport(`salesreceipt-${salesReceipt.Id}`, salesReceipt);

  // Format summary
  const lines: string[] = [
    'Sales Receipt',
    '=============',
    `ID: ${salesReceipt.Id}`,
    `SyncToken: ${salesReceipt.SyncToken}`,
    `Customer: ${salesReceipt.CustomerRef?.name || salesReceipt.CustomerRef?.value || '(none)'}`,
    `Date: ${salesReceipt.TxnDate}`,
    `Ref no.: ${salesReceipt.DocNumber || '(none)'}`,
    `Deposit To: ${salesReceipt.DepositToAccountRef?.name || salesReceipt.DepositToAccountRef?.value || '(default)'}`,
    `Department: ${salesReceipt.DepartmentRef?.name || salesReceipt.DepartmentRef?.value || '(none)'}`,
    `Memo: ${salesReceipt.PrivateNote || '(none)'}`,
    `Total: $${(salesReceipt.TotalAmt || 0).toFixed(2)}`,
    '',
    'Lines:',
  ];

  for (const line of salesReceipt.Line || []) {
    if (line.SalesItemLineDetail) {
      const detail = line.SalesItemLineDetail;
      const itemName = detail.ItemRef?.name || detail.ItemRef?.value || '(no item)';
      const qty = detail.Qty ?? 1;
      const unitPrice = detail.UnitPrice ?? line.Amount;
      const acctStr = detail.ItemAccountRef?.name ? ` → ${detail.ItemAccountRef.name}` : '';
      const descStr = line.Description ? ` "${line.Description}"` : '';
      lines.push(`  Line ${line.Id}: ${itemName} (Qty: ${qty} × $${unitPrice.toFixed(2)}) = $${line.Amount.toFixed(2)}${acctStr}${descStr}`);
    } else if (line.DetailType === 'SubTotalLineDetail') {
      lines.push(`  SubTotal: $${line.Amount.toFixed(2)}`);
    }
  }

  lines.push('');
  lines.push(`View in QuickBooks: ${qboUrl}`);
  lines.push(`Full data: ${filepath}`);

  return {
    content: [{ type: "text", text: lines.join('\n') }],
  };
}

export async function handleEditSalesReceipt(
  client: QuickBooks,
  args: {
    id: string;
    txn_date?: string;
    memo?: string;
    deposit_to_account?: string;
    department_name?: string;
    lines?: SalesReceiptLineChange[];
    draft?: boolean;
  }
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { id, txn_date, memo, deposit_to_account, department_name, lines: lineChanges, draft = true } = args;

  // Fetch current SalesReceipt
  const current = await promisify<unknown>((cb) =>
    client.getSalesReceipt(id, cb)
  ) as {
    Id: string;
    SyncToken: string;
    TxnDate: string;
    PrivateNote?: string;
    DepositToAccountRef?: { value: string; name?: string };
    DepartmentRef?: { value: string; name?: string };
    Line: Array<{
      Id: string;
      Amount: number;
      Description?: string;
      DetailType: string;
      SalesItemLineDetail?: {
        ItemRef: { value: string; name?: string };
        Qty?: number;
        UnitPrice?: number;
        ItemAccountRef?: { value: string; name?: string };
        ClassRef?: { value: string; name?: string };
        TaxCodeRef?: { value: string; name?: string };
      };
    }>;
  };

  // Determine if we're modifying lines - requires full update (not sparse)
  const needsFullUpdate = lineChanges && lineChanges.length > 0;

  // Build updated SalesReceipt
  const updated: Record<string, unknown> = {
    Id: current.Id,
    SyncToken: current.SyncToken,
  };

  // Only use sparse for non-line updates; full update needed for line modifications
  // Note: node-quickbooks auto-sets sparse=true, so we must explicitly set sparse=false for full updates
  if (!needsFullUpdate) {
    updated.sparse = true;
  } else {
    // Full update: explicitly set sparse=false (node-quickbooks defaults to true)
    updated.sparse = false;
    updated.TxnDate = current.TxnDate;
    updated.PrivateNote = current.PrivateNote;
    if (current.DepositToAccountRef) {
      updated.DepositToAccountRef = current.DepositToAccountRef;
    }
    if (current.DepartmentRef) {
      updated.DepartmentRef = current.DepartmentRef;
    }
    // Copy lines and strip read-only fields
    updated.Line = current.Line.map(line => {
      const { LineNum, ...rest } = line as Record<string, unknown>;
      return rest;
    });
  }

  if (txn_date !== undefined) updated.TxnDate = txn_date;
  if (memo !== undefined) updated.PrivateNote = memo;

  // Resolve deposit_to_account if provided (needs account cache)
  if (deposit_to_account !== undefined) {
    const { getAccountCache } = await import("../../client/index.js");
    const acctCache = await getAccountCache(client);
    let match = acctCache.byAcctNum.get(deposit_to_account.toLowerCase());
    if (!match) match = acctCache.byName.get(deposit_to_account.toLowerCase());
    if (!match) match = acctCache.items.find(a =>
      a.FullyQualifiedName?.toLowerCase().includes(deposit_to_account.toLowerCase())
    );
    if (!match) throw new Error(`Deposit account not found: "${deposit_to_account}"`);
    updated.DepositToAccountRef = { value: match.Id, name: match.FullyQualifiedName || match.Name };
  }

  // Resolve header-level department if provided
  if (department_name !== undefined) {
    const deptCache = await getDepartmentCache(client);
    let match = deptCache.byName.get(department_name.toLowerCase());
    if (!match) match = deptCache.items.find(d =>
      d.FullyQualifiedName?.toLowerCase().includes(department_name.toLowerCase())
    );
    if (!match) throw new Error(`Department not found: "${department_name}"`);
    updated.DepartmentRef = { value: match.Id, name: match.FullyQualifiedName || match.Name };
  }

  // Process line changes if provided
  // Use updated.Line if available (for full updates with stripped read-only fields), else current.Line
  let finalLines = [...((updated.Line as typeof current.Line) || current.Line)];

  if (lineChanges && lineChanges.length > 0) {
    const deptCache = await getDepartmentCache(client);

    const resolveDept = (name: string) => {
      let match = deptCache.byName.get(name.toLowerCase());
      if (!match) match = deptCache.items.find(d =>
        d.FullyQualifiedName?.toLowerCase().includes(name.toLowerCase())
      );
      if (!match) throw new Error(`Department not found: "${name}"`);
      return { value: match.Id, name: match.FullyQualifiedName || match.Name };
    };

    for (const change of lineChanges) {
      if (change.line_id) {
        const lineIndex = finalLines.findIndex(l => l.Id === change.line_id);
        if (lineIndex === -1) {
          throw new Error(`Line ID ${change.line_id} not found in sales receipt`);
        }

        if (change.delete) {
          finalLines.splice(lineIndex, 1);
        } else {
          const line = { ...finalLines[lineIndex] };
          const detail = { ...(line.SalesItemLineDetail || {}) } as {
            ItemRef?: { value: string; name?: string };
            Qty?: number;
            UnitPrice?: number;
            ItemAccountRef?: { value: string; name?: string };
            ClassRef?: { value: string; name?: string };
            TaxCodeRef?: { value: string; name?: string };
          };

          if (change.amount !== undefined) {
            const amountCents = validateAmount(change.amount, `Line ${change.line_id}`);
            line.Amount = toDollars(amountCents);
            // Update UnitPrice to match if Qty is 1 (common case)
            if (detail.Qty === 1 || detail.Qty === undefined) {
              detail.UnitPrice = toDollars(amountCents);
            }
          }
          if (change.description !== undefined) line.Description = change.description;
          if (change.department_name !== undefined) {
            (detail as Record<string, unknown>).ClassRef = resolveDept(change.department_name);
          }

          line.SalesItemLineDetail = detail as typeof line.SalesItemLineDetail;
          line.DetailType = 'SalesItemLineDetail';
          finalLines[lineIndex] = line;
        }
      } else {
        // Adding new lines would require item_id - skip for now
        throw new Error('Adding new lines to SalesReceipt requires item_id (not yet supported). Use line_id to modify existing lines.');
      }
    }

    updated.Line = finalLines;
  }

  const qboUrl = `https://app.qbo.intuit.com/app/salesreceipt?txnId=${id}`;

  if (draft) {
    const previewLines: string[] = [
      'DRAFT - Sales Receipt Edit Preview',
      '',
      `ID: ${id}`,
      `SyncToken: ${current.SyncToken}`,
      '',
      'Changes:',
    ];

    if (txn_date !== undefined) previewLines.push(`  Date: ${current.TxnDate} → ${txn_date}`);
    if (memo !== undefined) previewLines.push(`  Memo: ${current.PrivateNote || '(none)'} → ${memo}`);
    if (deposit_to_account !== undefined) {
      const newAcct = (updated.DepositToAccountRef as { name?: string })?.name || deposit_to_account;
      previewLines.push(`  Deposit To: ${current.DepositToAccountRef?.name || '(default)'} → ${newAcct}`);
    }
    if (department_name !== undefined) {
      const newDept = (updated.DepartmentRef as { name?: string })?.name || department_name;
      previewLines.push(`  Department: ${current.DepartmentRef?.name || '(none)'} → ${newDept}`);
    }

    if (updated.Line) {
      previewLines.push('');
      previewLines.push('Updated Lines:');
      for (const line of updated.Line as typeof finalLines) {
        const detail = line.SalesItemLineDetail;
        if (detail) {
          const itemName = detail.ItemRef?.name || detail.ItemRef?.value || '(item)';
          const descStr = line.Description ? ` "${line.Description}"` : '';
          previewLines.push(`  ${itemName}: $${line.Amount.toFixed(2)}${descStr}`);
        }
      }
    }

    previewLines.push('');
    previewLines.push('Set draft=false to apply these changes.');

    return {
      content: [{ type: "text", text: previewLines.join('\n') }],
    };
  }

  const result = await promisify<unknown>((cb) =>
    client.updateSalesReceipt(updated, cb)
  ) as { Id: string; SyncToken: string };

  return {
    content: [{ type: "text", text: `Sales Receipt ${id} updated successfully.\nNew SyncToken: ${result.SyncToken}\nView in QuickBooks: ${qboUrl}` }],
  };
}
