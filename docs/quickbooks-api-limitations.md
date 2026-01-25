# QuickBooks Online API Limitations

## Query Filtering Limitations

Only fields marked as **"filterable"** in the [Intuit API reference](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/account) are queryable in WHERE clauses.

### Non-Filterable Reference Fields

The following reference fields are **NOT queryable** on transaction entities:

| Field | Entities Tested | Result |
|-------|-----------------|--------|
| `DepartmentRef` | SalesReceipt, JournalEntry, Purchase, Invoice | `QueryValidationError: property 'DepartmentRef' is not queryable` |
| `AccountRef` | JournalEntry, Invoice, Deposit | `QueryValidationError: Property AccountRef not found for Entity` |

### Commonly Filterable Fields

Based on API documentation, these fields are typically filterable:

- `TxnDate` - Transaction date
- `CreateTime` / `LastUpdatedTime` - Metadata timestamps
- `DocNumber` - Document/reference number
- `CustomerRef` - Customer reference (on some entities)
- `Active` - Active status (on master data entities)

### Workarounds

Since DepartmentRef and AccountRef cannot be filtered server-side:

1. **For Reports**: Use the `department` parameter on P&L and Balance Sheet reports (these use a different API endpoint that supports department filtering)

2. **For Queries**: Fetch all records and filter client-side using tools like `jq`:
   ```bash
   # Filter SalesReceipts by department
   cat results.json | jq '.QueryResponse.SalesReceipt[] | select(.DepartmentRef.value == "5")'

   # Filter JournalEntry lines by account
   cat results.json | jq '.QueryResponse.JournalEntry[].Line[] | select(.JournalEntryLineDetail.AccountRef.value == "123")'
   ```

## Other Query Limitations

From [Intuit's Data Queries documentation](https://developer.intuit.com/app/developer/qbo/docs/learn/explore-the-quickbooks-online-api/data-queries):

- **No projections**: Response returns all properties for each object
- **No OR operator**: WHERE clauses don't support OR
- **No GROUP BY**: Aggregation not supported
- **No JOIN**: Cannot join entities
- **Single quotes required**: Comparison values must use single quotes (`'value'`), not double quotes
- **Max 1000 results**: Use `STARTPOSITION` for pagination
- **Wildcard limited to %**: Only `LIKE '%pattern%'` supported, no other wildcards

## Sparse Update Required Fields

When performing sparse updates (`sparse: true`), certain fields are **required** beyond just `Id` and `SyncToken`, even though you're only updating a subset of the entity.

| Entity | Required Fields | Notes |
|--------|-----------------|-------|
| **JournalEntry** | `Id`, `SyncToken` | Minimal requirements |
| **Bill** | `Id`, `SyncToken`, `VendorRef` | Must include vendor reference |
| **Purchase** (Expense) | `Id`, `SyncToken`, `PaymentType` | PaymentType cannot be changed, but must be included |

### Example Error

If you omit a required field like `PaymentType` on a Purchase update:

```json
{
  "Fault": {
    "Error": [{
      "Message": "Required param missing, need to supply the required value for the API",
      "Detail": "Required parameter PaymentType is missing in the request",
      "code": "2020",
      "element": "PaymentType"
    }],
    "type": "ValidationFault"
  }
}
```

### Implementation Notes

The MCP edit tools (`edit_journal_entry`, `edit_bill`, `edit_expense`) automatically include these required fields by:
1. Fetching the current entity state
2. Copying the required fields to the update payload
3. Applying only the requested changes

## References

- [Data Queries - Intuit Developer](https://developer.intuit.com/app/developer/qbo/docs/learn/explore-the-quickbooks-online-api/data-queries)
- [Deep Dive into QuickBooks Online Data Queries](https://blogs.intuit.com/2017/02/08/deep-dive-sql-queries/)
- [Purchase API Reference](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/Purchase)
