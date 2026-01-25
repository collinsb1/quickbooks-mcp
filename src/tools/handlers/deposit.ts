// Handlers for deposit tools (get, edit)

import QuickBooks from "node-quickbooks";
import {
  promisify,
  getAccountCache,
  getDepartmentCache,
} from "../../client/index.js";
import { writeReport, validateAmount, toDollars, toCents, sumCents } from "../../utils/index.js";

// For full line replacement - each line requires amount and account
// If line_id is provided, updates existing line; otherwise creates new line
interface DepositLineInput {
  line_id?: string;  // Include to update existing line (preserves Entity ref)
  amount: number;
  account_name: string;
  description?: string;
  department_name?: string;
}

interface DepositLine {
  Id?: string;
  Amount: number;
  Description?: string;
  DetailType: string;
  DepositLineDetail?: {
    AccountRef?: { value: string; name?: string };
    Entity?: {
      value: string;
      name?: string;
      type?: string;
    };
    ClassRef?: { value: string; name?: string };
  };
}

interface Deposit {
  Id: string;
  SyncToken: string;
  TxnDate: string;
  PrivateNote?: string;
  TotalAmt?: number;
  DepositToAccountRef?: { value: string; name?: string };
  DepartmentRef?: { value: string; name?: string };
  Line?: DepositLine[];
}

export async function handleGetDeposit(
  client: QuickBooks,
  args: { id: string }
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { id } = args;

  const deposit = await promisify<unknown>((cb) =>
    client.getDeposit(id, cb)
  ) as Deposit;
  const qboUrl = `https://app.qbo.intuit.com/app/deposit?txnId=${deposit.Id}`;

  // Write full object to file
  const filepath = writeReport(`deposit-${deposit.Id}`, deposit);

  // Format summary
  const lines: string[] = [
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
  lines.push(`Full data: ${filepath}`);

  return {
    content: [{ type: "text", text: lines.join('\n') }],
  };
}

export async function handleEditDeposit(
  client: QuickBooks,
  args: {
    id: string;
    txn_date?: string;
    memo?: string;
    deposit_to_account?: string;
    department_name?: string;
    lines?: DepositLineInput[];
    draft?: boolean;
    expected_total?: number;  // For fixing corrupted deposits - bypasses validation
  }
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { id, txn_date, memo, deposit_to_account, department_name, lines: newLines, draft = true, expected_total } = args;

  // Fetch current Deposit
  const current = await promisify<unknown>((cb) =>
    client.getDeposit(id, cb)
  ) as Deposit;

  // Determine if we're replacing lines - requires full update (not sparse)
  const needsFullUpdate = newLines && newLines.length > 0;

  // Build updated Deposit
  let updated: Record<string, unknown>;

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
  } else {
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
    if ((current as unknown as Record<string, unknown>).CurrencyRef) {
      updated.CurrencyRef = (current as unknown as Record<string, unknown>).CurrencyRef;
    }
    // Copy lines and strip read-only fields
    updated.Line = (current.Line || []).map(line => {
      const { LineNum, CustomExtensions, ...rest } = line as unknown as Record<string, unknown>;
      return rest;
    });
  }

  if (txn_date !== undefined) updated.TxnDate = txn_date;
  if (memo !== undefined) updated.PrivateNote = memo;

  // Resolve deposit_to_account if provided
  if (deposit_to_account !== undefined) {
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

  // Process full line replacement if provided
  // QB API does not support deleting individual deposit lines, so we do full replacement
  // The new lines must sum to the same total as the original deposit (bank amount cannot change)
  if (newLines && newLines.length > 0) {
    const acctCache = await getAccountCache(client);
    const deptCache = await getDepartmentCache(client);

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

    // Build new lines array (full replacement)
    // If line_id is provided, find existing line and update it (preserves Entity ref)
    // If line_id is not provided, create a new line
    const currentLines = current.Line || [];
    const currentLinesById = new Map(currentLines.map(l => [l.Id, l]));
    const finalLines: DepositLine[] = [];
    const lineCents: number[] = [];

    for (let i = 0; i < newLines.length; i++) {
      const input = newLines[i];
      const amountCents = validateAmount(input.amount, `Line ${i + 1}`);
      lineCents.push(amountCents);

      let line: DepositLine;

      if (input.line_id) {
        // Update existing line - preserve Entity ref
        const existing = currentLinesById.get(input.line_id);
        if (!existing) {
          throw new Error(`Line ID ${input.line_id} not found in deposit`);
        }
        // Clone the existing line to preserve Entity (strip read-only fields)
        const existingAny = existing as unknown as Record<string, unknown>;
        const { LineNum, CustomExtensions, ...rest } = existingAny;
        line = rest as unknown as DepositLine;
        line.Amount = toDollars(amountCents);
        line.DepositLineDetail = {
          ...line.DepositLineDetail,
          AccountRef: resolveAcct(input.account_name),
        };
      } else {
        // Create new line
        line = {
          Amount: toDollars(amountCents),
          DetailType: 'DepositLineDetail',
          DepositLineDetail: {
            AccountRef: resolveAcct(input.account_name),
          },
        };
      }

      if (input.description !== undefined) {
        line.Description = input.description;
      }
      if (input.department_name !== undefined) {
        line.DepositLineDetail!.ClassRef = resolveDept(input.department_name);
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
      throw new Error(
        `Line amounts must sum to the ${targetLabel} total. ` +
        `Target: $${toDollars(targetTotalCents).toFixed(2)}, ` +
        `New total: $${toDollars(newTotalCents).toFixed(2)} ` +
        `(difference: $${diff >= 0 ? '+' : ''}${diff.toFixed(2)}). ` +
        (expected_total === undefined ? `The bank deposit amount cannot change.` : '')
      );
    }

    updated.Line = finalLines;
  }

  const qboUrl = `https://app.qbo.intuit.com/app/deposit?txnId=${id}`;

  if (draft) {
    const previewLines: string[] = [
      'DRAFT - Deposit Edit Preview',
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
      previewLines.push(`New Lines (replacing ${current.Line?.length || 0} existing lines):`);
      let lineTotal = 0;
      for (const line of updated.Line as DepositLine[]) {
        const detail = line.DepositLineDetail;
        if (detail) {
          const acctName = detail.AccountRef?.name || detail.AccountRef?.value || '(account)';
          const deptStr = detail.ClassRef?.name ? ` [${detail.ClassRef.name}]` : '';
          const descStr = line.Description ? ` "${line.Description}"` : '';
          previewLines.push(`  ${acctName}: $${line.Amount.toFixed(2)}${deptStr}${descStr}`);
          lineTotal += line.Amount;
        }
      }
      previewLines.push(`  ─────────────`);
      if (expected_total !== undefined) {
        previewLines.push(`  Total: $${lineTotal.toFixed(2)} (expected: $${expected_total.toFixed(2)}, current: $${(current.TotalAmt || 0).toFixed(2)})`);
      } else {
        previewLines.push(`  Total: $${lineTotal.toFixed(2)} (must equal original: $${(current.TotalAmt || 0).toFixed(2)})`);
      }
    }

    previewLines.push('');
    previewLines.push('Set draft=false to apply these changes.');

    return {
      content: [{ type: "text", text: previewLines.join('\n') }],
    };
  }

  const result = await promisify<unknown>((cb) =>
    client.updateDeposit(updated, cb)
  ) as { Id: string; SyncToken: string };

  return {
    content: [{ type: "text", text: `Deposit ${id} updated successfully.\nNew SyncToken: ${result.SyncToken}\nView in QuickBooks: ${qboUrl}` }],
  };
}
