// Account and department caching for QuickBooks lookups
import { promisify } from "./promisify.js";
// Cache TTL (15 minutes)
const LOOKUP_CACHE_TTL_MS = 15 * 60 * 1000;
// Module-level cache state
let departmentCache = null;
let classCache = null;
let accountCache = null;
let vendorCache = null;
let entityCache = null;
// Item cache: lazy per-entry lookup (not bulk-loaded like others)
const itemCacheById = new Map();
const itemCacheByName = new Map(); // lowercase key
// Customer cache: lazy per-entry lookup (companies can have thousands)
const customerCacheById = new Map();
const customerCacheByName = new Map(); // lowercase key
export function clearLookupCache() {
    departmentCache = null;
    classCache = null;
    accountCache = null;
    vendorCache = null;
    entityCache = null;
    itemCacheById.clear();
    itemCacheByName.clear();
    customerCacheById.clear();
    customerCacheByName.clear();
}
// Helper to extract entities from QB query response with type safety
function extractQueryResults(result, entityKey) {
    const response = result;
    const entities = response?.QueryResponse?.[entityKey];
    return Array.isArray(entities) ? entities : [];
}
export async function getDepartmentCache(client) {
    if (departmentCache && (Date.now() - departmentCache.fetchedAt) < LOOKUP_CACHE_TTL_MS) {
        return departmentCache;
    }
    const result = await promisify((cb) => client.findDepartments({ fetchAll: true }, cb));
    const items = extractQueryResults(result, 'Department');
    const byId = new Map();
    const byName = new Map();
    for (const dept of items) {
        byId.set(dept.Id, dept);
        byName.set(dept.Name.toLowerCase(), dept);
    }
    departmentCache = { items, byId, byName, fetchedAt: Date.now() };
    return departmentCache;
}
export async function getClassCache(client) {
    if (classCache && (Date.now() - classCache.fetchedAt) < LOOKUP_CACHE_TTL_MS) {
        return classCache;
    }
    const result = await promisify((cb) => client.findClasses({ fetchAll: true }, cb));
    const items = extractQueryResults(result, 'Class');
    const byId = new Map();
    const byName = new Map();
    for (const cls of items) {
        byId.set(cls.Id, cls);
        byName.set(cls.Name.toLowerCase(), cls);
    }
    classCache = { items, byId, byName, fetchedAt: Date.now() };
    return classCache;
}
export async function getAccountCache(client) {
    if (accountCache && (Date.now() - accountCache.fetchedAt) < LOOKUP_CACHE_TTL_MS) {
        return accountCache;
    }
    const result = await promisify((cb) => client.findAccounts({ fetchAll: true }, cb));
    const items = extractQueryResults(result, 'Account');
    const byId = new Map();
    const byName = new Map();
    const byAcctNum = new Map();
    for (const acct of items) {
        byId.set(acct.Id, acct);
        byName.set(acct.Name.toLowerCase(), acct);
        if (acct.AcctNum) {
            byAcctNum.set(acct.AcctNum.toLowerCase(), acct);
        }
    }
    accountCache = { items, byId, byName, byAcctNum, fetchedAt: Date.now() };
    return accountCache;
}
// Resolve account by name, AcctNum, or ID using cache
export async function resolveAccount(client, account) {
    const cache = await getAccountCache(client);
    // Try exact ID match
    const byId = cache.byId.get(account);
    if (byId)
        return byId;
    // Try exact AcctNum match (case-insensitive)
    const byAcctNum = cache.byAcctNum.get(account.toLowerCase());
    if (byAcctNum)
        return byAcctNum;
    // Try exact name match (case-insensitive)
    const byName = cache.byName.get(account.toLowerCase());
    if (byName)
        return byName;
    // Try partial FullyQualifiedName match
    const byPartial = cache.items.find(a => a.FullyQualifiedName?.toLowerCase().includes(account.toLowerCase()));
    if (byPartial)
        return byPartial;
    throw new Error(`Account not found: "${account}". Try using account name, number (AcctNum), or ID.`);
}
export async function getVendorCache(client) {
    if (vendorCache && (Date.now() - vendorCache.fetchedAt) < LOOKUP_CACHE_TTL_MS) {
        return vendorCache;
    }
    const result = await promisify((cb) => client.findVendors({ fetchAll: true }, cb));
    const items = extractQueryResults(result, 'Vendor');
    const byId = new Map();
    const byName = new Map();
    for (const vendor of items) {
        byId.set(vendor.Id, vendor);
        byName.set(vendor.DisplayName.toLowerCase(), vendor);
    }
    vendorCache = { items, byId, byName, fetchedAt: Date.now() };
    return vendorCache;
}
// Resolve vendor by name or ID using cache
// Returns { value, name } ref object for QuickBooks API
export async function resolveVendor(client, nameOrId) {
    const cache = await getVendorCache(client);
    // Try exact ID match
    const byId = cache.byId.get(nameOrId);
    if (byId)
        return { value: byId.Id, name: byId.DisplayName };
    // Try exact name match (case-insensitive)
    const byName = cache.byName.get(nameOrId.toLowerCase());
    if (byName)
        return { value: byName.Id, name: byName.DisplayName };
    // Try partial name match
    const byPartial = cache.items.find(v => v.DisplayName.toLowerCase().includes(nameOrId.toLowerCase()));
    if (byPartial)
        return { value: byPartial.Id, name: byPartial.DisplayName };
    throw new Error(`Vendor not found: "${nameOrId}". Try using vendor display name or ID.`);
}
// Resolve item by name or ID using lazy per-entry cache
// Unlike other caches, items are fetched on demand (companies can have thousands)
export async function resolveItem(client, nameOrId) {
    // Check cache first (with TTL)
    const cached = itemCacheById.get(nameOrId) || itemCacheByName.get(nameOrId.toLowerCase());
    if (cached && (Date.now() - cached.fetchedAt) < LOOKUP_CACHE_TTL_MS) {
        return { value: cached.Id, name: cached.Name };
    }
    // Query QB for this specific item
    // Try exact name match first, then partial
    const result = await promisify((cb) => client.findItems([
        { field: 'Name', value: nameOrId, operator: '=' },
        { field: 'Active', value: true, operator: '=' },
    ], cb));
    let items = extractQueryResults(result, 'Item');
    // If no exact match, try LIKE for partial matching
    if (items.length === 0) {
        const partialResult = await promisify((cb) => client.findItems([
            { field: 'Name', value: `%${nameOrId}%`, operator: 'LIKE' },
            { field: 'Active', value: true, operator: '=' },
        ], cb));
        items = extractQueryResults(partialResult, 'Item');
    }
    if (items.length === 0) {
        throw new Error(`Item not found: "${nameOrId}". Try using the exact item name or ID.`);
    }
    // Use first match and cache it
    const item = items[0];
    const entry = {
        Id: item.Id,
        Name: item.Name,
        FullyQualifiedName: item.FullyQualifiedName,
        Type: item.Type,
        UnitPrice: item.UnitPrice,
        Active: item.Active,
        fetchedAt: Date.now(),
    };
    itemCacheById.set(item.Id, entry);
    itemCacheByName.set(item.Name.toLowerCase(), entry);
    return { value: item.Id, name: item.Name };
}
// Helper to resolve department name to ID using cache
// Accepts: internal ID (e.g., "5"), name (e.g., "20400"), or partial match
export async function resolveDepartmentId(client, department) {
    const cache = await getDepartmentCache(client);
    // Try exact ID match first
    const byId = cache.byId.get(department);
    if (byId)
        return byId.Id;
    // Try exact name match (case-insensitive)
    const byName = cache.byName.get(department.toLowerCase());
    if (byName)
        return byName.Id;
    // Try partial/fuzzy match on FullyQualifiedName
    const byPartial = cache.items.find(d => d.FullyQualifiedName?.toLowerCase().includes(department.toLowerCase()));
    if (byPartial)
        return byPartial.Id;
    // If nothing found, return as-is (let API handle error)
    return department;
}
// Helper to resolve class name to ID using cache
// Accepts: internal ID (e.g., "5"), name (e.g., "Engineering"), or partial match
export async function resolveClassId(client, cls) {
    const cache = await getClassCache(client);
    // Try exact ID match first
    const byId = cache.byId.get(cls);
    if (byId)
        return byId.Id;
    // Try exact name match (case-insensitive)
    const byName = cache.byName.get(cls.toLowerCase());
    if (byName)
        return byName.Id;
    // Try partial/fuzzy match on FullyQualifiedName
    const byPartial = cache.items.find(c => c.FullyQualifiedName?.toLowerCase().includes(cls.toLowerCase()));
    if (byPartial)
        return byPartial.Id;
    // If nothing found, return as-is (let API handle error)
    return cls;
}
// Resolve customer by name or ID using lazy per-entry cache
// Unlike vendor/account caches, customers are fetched on demand (companies can have thousands)
export async function resolveCustomer(client, nameOrId) {
    // Check cache first (with TTL)
    const cached = customerCacheById.get(nameOrId) || customerCacheByName.get(nameOrId.toLowerCase());
    if (cached && (Date.now() - cached.fetchedAt) < LOOKUP_CACHE_TTL_MS) {
        return { value: cached.Id, name: cached.DisplayName };
    }
    // Query QB for this specific customer — exact DisplayName match first
    const result = await promisify((cb) => client.findCustomers([
        { field: 'DisplayName', value: nameOrId, operator: '=' },
        { field: 'Active', value: true, operator: '=' },
    ], cb));
    let customers = extractQueryResults(result, 'Customer');
    // If no exact match, try LIKE for partial matching
    if (customers.length === 0) {
        const partialResult = await promisify((cb) => client.findCustomers([
            { field: 'DisplayName', value: `%${nameOrId}%`, operator: 'LIKE' },
            { field: 'Active', value: true, operator: '=' },
        ], cb));
        customers = extractQueryResults(partialResult, 'Customer');
    }
    if (customers.length === 0) {
        throw new Error(`Customer not found: "${nameOrId}". Try using the exact customer display name or ID.`);
    }
    // Use first match and cache it
    const customer = customers[0];
    const entry = {
        Id: customer.Id,
        DisplayName: customer.DisplayName,
        Active: customer.Active,
        fetchedAt: Date.now(),
    };
    customerCacheById.set(customer.Id, entry);
    customerCacheByName.set(customer.DisplayName.toLowerCase(), entry);
    return { value: customer.Id, name: customer.DisplayName };
}
// Bulk-load Customers + Vendors into a single unified entity cache
// This mirrors QBO's "Name" field on JEs which shows one merged list
export async function getEntityCache(client) {
    if (entityCache && (Date.now() - entityCache.fetchedAt) < LOOKUP_CACHE_TTL_MS) {
        return entityCache;
    }
    // Fetch both in parallel
    const [vendorResult, customerResult] = await Promise.all([
        promisify((cb) => client.findVendors({ fetchAll: true }, cb)),
        promisify((cb) => client.findCustomers({ fetchAll: true }, cb)),
    ]);
    const vendors = extractQueryResults(vendorResult, 'Vendor');
    const customers = extractQueryResults(customerResult, 'Customer');
    const byId = new Map();
    const byName = new Map();
    const items = [];
    for (const v of vendors) {
        const entity = { Id: v.Id, DisplayName: v.DisplayName, Type: 'Vendor', Active: v.Active };
        items.push(entity);
        byId.set(v.Id, entity);
        byName.set(v.DisplayName.toLowerCase(), entity);
    }
    for (const c of customers) {
        const entity = { Id: c.Id, DisplayName: c.DisplayName, Type: 'Customer', Active: c.Active };
        items.push(entity);
        byId.set(c.Id, entity);
        // If name collision with a vendor, customer wins (matches QBO behavior)
        byName.set(c.DisplayName.toLowerCase(), entity);
    }
    entityCache = { items, byId, byName, fetchedAt: Date.now() };
    return entityCache;
}
// Resolve entity name against combined Customer+Vendor cache with fuzzy detection
// Returns:
//   exact  — single exact match found (case-insensitive)
//   fuzzy  — no exact match but 1+ candidates found via substring or word overlap
//   none   — no match at all (likely a new entity, post without Entity field)
export async function resolveEntityName(client, nameOrId) {
    const cache = await getEntityCache(client);
    const needle = nameOrId.toLowerCase().trim();
    // 1. Exact ID match
    const byId = cache.byId.get(nameOrId);
    if (byId)
        return { kind: 'exact', entity: byId };
    // 2. Exact name match (case-insensitive)
    const byName = cache.byName.get(needle);
    if (byName)
        return { kind: 'exact', entity: byName };
    // 3. Fuzzy matching — substring in either direction OR ≥50% word overlap
    const candidates = [];
    const needleWords = needle.split(/\s+/).filter(w => w.length > 1);
    for (const entity of cache.items) {
        const hay = entity.DisplayName.toLowerCase();
        // Substring: needle contains hay or hay contains needle
        if (hay.includes(needle) || needle.includes(hay)) {
            candidates.push(entity);
            continue;
        }
        // Word overlap: ≥50% of needle words appear in the entity name
        if (needleWords.length > 0) {
            const matchCount = needleWords.filter(w => hay.includes(w)).length;
            if (matchCount / needleWords.length >= 0.5) {
                candidates.push(entity);
            }
        }
    }
    if (candidates.length > 0)
        return { kind: 'fuzzy', candidates };
    return { kind: 'none' };
}
//# sourceMappingURL=cache.js.map