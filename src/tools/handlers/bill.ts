// Handlers for bill tools (get, edit)

import QuickBooks from "node-quickbooks";
import {
  promisify,
  getAccountCache,
  getDepartmentCache,
} from "../../client/index.js";
import { writeReport, validateAmount, toDollars } from "../../utils/index.js";

interface BillLineChange {
  line_id?: string;
  account_name?: string;
  amount?: number;
  description?: string;
  department_name?: string;
  delete?: boolean;
}

export async function handleGetBill(
  client: QuickBooks,
  args: { id: string }
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { id } = args;

  const bill = await promisify<unknown>((cb) =>
    client.getBill(id, cb)
  ) as {
    Id: string;
    SyncToken: string;
    TxnDate: string;
    DueDate?: string;
    DocNumber?: string;
    PrivateNote?: string;
    TotalAmt?: number;
    VendorRef?: { value: string; name?: string };
    APAccountRef?: { value: string; name?: string };
    Line?: Array<{
      Id: string;
      Amount: number;
      Description?: string;
      DetailType: string;
      AccountBasedExpenseLineDetail?: {
        AccountRef: { value: string; name?: string };
        DepartmentRef?: { value: string; name?: string };
      };
      ItemBasedExpenseLineDetail?: {
        ItemRef: { value: string; name?: string };
        Qty?: number;
        UnitPrice?: number;
      };
    }>;
  };
  const qboUrl = `https://app.qbo.intuit.com/app/bill?txnId=${bill.Id}`;

  // Write full object to file
  const filepath = writeReport(`bill-${bill.Id}`, bill);

  // Format summary
  const lines: string[] = [
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
    } else if (line.ItemBasedExpenseLineDetail) {
      const detail = line.ItemBasedExpenseLineDetail;
      const itemName = detail.ItemRef.name || detail.ItemRef.value;
      const descStr = line.Description ? ` "${line.Description}"` : '';
      lines.push(`  Line ${line.Id}: Item: ${itemName} (Qty: ${detail.Qty || 1}) $${line.Amount.toFixed(2)}${descStr}`);
    }
  }

  lines.push('');
  lines.push(`View in QuickBooks: ${qboUrl}`);
  lines.push(`Full data: ${filepath}`);

  return {
    content: [{ type: "text", text: lines.join('\n') }],
  };
}

export async function handleEditBill(
  client: QuickBooks,
  args: {
    id: string;
    txn_date?: string;
    due_date?: string;
    memo?: string;
    lines?: BillLineChange[];
    draft?: boolean;
  }
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { id, txn_date, due_date, memo, lines: lineChanges, draft = true } = args;

  // Fetch current Bill
  const current = await promisify<unknown>((cb) =>
    client.getBill(id, cb)
  ) as {
    Id: string;
    SyncToken: string;
    TxnDate: string;
    DueDate?: string;
    PrivateNote?: string;
    VendorRef: { value: string; name?: string };
    Line: Array<{
      Id: string;
      Amount: number;
      Description?: string;
      DetailType: string;
      AccountBasedExpenseLineDetail?: {
        AccountRef: { value: string; name?: string };
        DepartmentRef?: { value: string; name?: string };
      };
    }>;
  };

  // Determine if we're modifying lines - requires full update (not sparse)
  const needsFullUpdate = lineChanges && lineChanges.length > 0;

  // Build updated Bill
  // Note: VendorRef is required by QB API even for sparse updates
  const updated: Record<string, unknown> = {
    Id: current.Id,
    SyncToken: current.SyncToken,
    VendorRef: current.VendorRef,
  };

  // Only use sparse for non-line updates; full update needed for line modifications
  // Note: node-quickbooks auto-sets sparse=true, so we must explicitly set sparse=false for full updates
  if (!needsFullUpdate) {
    updated.sparse = true;
  } else {
    // Full update: explicitly set sparse=false (node-quickbooks defaults to true)
    updated.sparse = false;
    updated.TxnDate = current.TxnDate;
    updated.DueDate = current.DueDate;
    updated.PrivateNote = current.PrivateNote;
    // Copy lines and strip read-only fields
    updated.Line = current.Line.map(line => {
      const { LineNum, ...rest } = line as Record<string, unknown>;
      return rest;
    });
  }

  if (txn_date !== undefined) updated.TxnDate = txn_date;
  if (due_date !== undefined) updated.DueDate = due_date;
  if (memo !== undefined) updated.PrivateNote = memo;

  // Process line changes if provided
  // Use updated.Line if available (for full updates with stripped read-only fields), else current.Line
  let finalLines = [...((updated.Line as typeof current.Line) || current.Line)];

  if (lineChanges && lineChanges.length > 0) {
    const [acctCache, deptCache] = await Promise.all([
      getAccountCache(client),
      getDepartmentCache(client)
    ]);

    const resolveAcct = (name: string) => {
      let match = acctCache.byAcctNum.get(name.toLowerCase());
      if (!match) match = acctCache.byName.get(name.toLowerCase());
      if (!match) match = acctCache.items.find(a =>
        a.FullyQualifiedName?.toLowerCase().includes(name.toLowerCase())
      );
      if (!match) throw new Error(`Account not found: "${name}"`);
      return { value: match.Id, name: match.FullyQualifiedName || match.Name };
    };

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
          throw new Error(`Line ID ${change.line_id} not found in bill`);
        }

        if (change.delete) {
          finalLines.splice(lineIndex, 1);
        } else {
          const line = { ...finalLines[lineIndex] };
          const detail = { ...(line.AccountBasedExpenseLineDetail || {}) } as {
            AccountRef: { value: string; name?: string };
            DepartmentRef?: { value: string; name?: string };
          };

          if (change.amount !== undefined) {
            const amountCents = validateAmount(change.amount, `Line ${change.line_id}`);
            line.Amount = toDollars(amountCents);
          }
          if (change.description !== undefined) line.Description = change.description;
          if (change.account_name !== undefined) detail.AccountRef = resolveAcct(change.account_name);
          if (change.department_name !== undefined) detail.DepartmentRef = resolveDept(change.department_name);

          line.AccountBasedExpenseLineDetail = detail;
          line.DetailType = 'AccountBasedExpenseLineDetail';
          finalLines[lineIndex] = line;
        }
      } else {
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
            ...(change.department_name && { DepartmentRef: resolveDept(change.department_name) })
          }
        } as typeof finalLines[0];
        finalLines.push(newLine);
      }
    }

    updated.Line = finalLines;
  }

  const qboUrl = `https://app.qbo.intuit.com/app/bill?txnId=${id}`;

  if (draft) {
    const previewLines: string[] = [
      'DRAFT - Bill Edit Preview',
      '',
      `ID: ${id}`,
      `SyncToken: ${current.SyncToken}`,
      '',
      'Changes:',
    ];

    if (txn_date !== undefined) previewLines.push(`  Date: ${current.TxnDate} → ${txn_date}`);
    if (due_date !== undefined) previewLines.push(`  Due Date: ${current.DueDate || '(none)'} → ${due_date}`);
    if (memo !== undefined) previewLines.push(`  Memo: ${current.PrivateNote || '(none)'} → ${memo}`);

    if (updated.Line) {
      previewLines.push('');
      previewLines.push('Updated Lines:');
      for (const line of updated.Line as typeof finalLines) {
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

  const result = await promisify<unknown>((cb) =>
    client.updateBill(updated, cb)
  ) as { Id: string; SyncToken: string };

  return {
    content: [{ type: "text", text: `Bill ${id} updated successfully.\nNew SyncToken: ${result.SyncToken}\nView in QuickBooks: ${qboUrl}` }],
  };
}
