# QuickBooks MCP Server

## Project Overview

This is a Model Context Protocol (MCP) server that provides Claude with access to QuickBooks Online. It enables Claude to query, create, and edit accounting data including journal entries, bills, expenses, and reports.

## Architecture

```
src/
├── index.ts           # MCP server entry point, tool definitions
├── client/            # QuickBooks API client and caching
├── types/             # TypeScript type definitions
├── utils/             # Utility functions (files, URLs, money)
├── query/             # Query helpers and pagination
├── reports/           # Report handlers (P&L, Balance Sheet, Trial Balance)
└── tools/
    ├── definitions/   # Tool schema definitions
    └── handlers/      # Tool implementation handlers
```

## Key Conventions

### Cents-Based Money Handling

All monetary calculations use integer cents to avoid floating-point precision errors:

```typescript
import { validateAmount, toCents, toDollars, sumCents, validateBalance } from "./utils/index.js";

// Validate input (rejects >2 decimal places)
const cents = validateAmount(amount, "Line description");  // throws if 10.001

// Sum safely (integer addition)
const totalCents = sumCents([amountACents, amountBCents]);

// Journal entries must balance exactly
validateBalance(debitsCents, creditsCents);  // throws if not equal
```

### Draft Mode for Writes

All write operations (create/edit) default to `draft: true`:
- Shows a preview of what would be created/modified
- User must explicitly set `draft: false` to commit changes
- Prevents accidental modifications to accounting data

### Account/Department Resolution

Names are auto-resolved to IDs using cached lookups:
- `account_name: "Tips"` → looks up ID from cache
- `department_name: "Santa Rosa"` → looks up ID from cache
- Caches are session-scoped with TTL

## Common Files

| Task | File |
|------|------|
| Add a new tool | `src/tools/definitions/*.ts`, `src/tools/handlers/*.ts`, `src/index.ts` |
| Modify reports | `src/reports/handlers/*.ts` |
| Change query behavior | `src/query/pagination.ts` |
| Money utilities | `src/utils/money.ts` |
| API client | `src/client/quickbooks.ts` |

## Building and Testing

```bash
npm run build     # Compile TypeScript
npm run watch     # Watch mode for development
```

After changes, restart Claude Code to reload the MCP server.

## QuickBooks API Notes

- All updates require `SyncToken` for optimistic concurrency
- Some entities require additional fields for sparse updates:
  - Bill: `VendorRef`
  - Purchase (Expense): `PaymentType`
- Department/Location filtering must be done client-side (not in QB queries)
- See `docs/quickbooks-api-limitations.md` for details
