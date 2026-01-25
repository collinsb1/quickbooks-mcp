// Account and department caching for QuickBooks lookups

import QuickBooks from "node-quickbooks";
import { promisify } from "./promisify.js";
import {
  CachedAccount,
  CachedDepartment,
  AccountCache,
  DepartmentCache,
  QBQueryResponse,
} from "../types/index.js";

// Cache TTL (15 minutes)
const LOOKUP_CACHE_TTL_MS = 15 * 60 * 1000;

// Module-level cache state
let departmentCache: DepartmentCache | null = null;
let accountCache: AccountCache | null = null;

export function clearLookupCache(): void {
  departmentCache = null;
  accountCache = null;
}

// Helper to extract entities from QB query response with type safety
function extractQueryResults<T>(result: unknown, entityKey: string): T[] {
  const response = result as QBQueryResponse<T> | undefined;
  const entities = response?.QueryResponse?.[entityKey];
  return Array.isArray(entities) ? entities : [];
}

export async function getDepartmentCache(client: QuickBooks): Promise<DepartmentCache> {
  if (departmentCache && (Date.now() - departmentCache.fetchedAt) < LOOKUP_CACHE_TTL_MS) {
    return departmentCache;
  }

  const result = await promisify<unknown>((cb) => client.findDepartments({ fetchAll: true }, cb));
  const items = extractQueryResults<CachedDepartment>(result, 'Department');

  const byId = new Map<string, CachedDepartment>();
  const byName = new Map<string, CachedDepartment>();
  for (const dept of items) {
    byId.set(dept.Id, dept);
    byName.set(dept.Name.toLowerCase(), dept);
  }

  departmentCache = { items, byId, byName, fetchedAt: Date.now() };
  return departmentCache;
}

export async function getAccountCache(client: QuickBooks): Promise<AccountCache> {
  if (accountCache && (Date.now() - accountCache.fetchedAt) < LOOKUP_CACHE_TTL_MS) {
    return accountCache;
  }

  const result = await promisify<unknown>((cb) => client.findAccounts({ fetchAll: true }, cb));
  const items = extractQueryResults<CachedAccount>(result, 'Account');

  const byId = new Map<string, CachedAccount>();
  const byName = new Map<string, CachedAccount>();
  const byAcctNum = new Map<string, CachedAccount>();
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
export async function resolveAccount(client: QuickBooks, account: string): Promise<CachedAccount> {
  const cache = await getAccountCache(client);

  // Try exact ID match
  const byId = cache.byId.get(account);
  if (byId) return byId;

  // Try exact AcctNum match (case-insensitive)
  const byAcctNum = cache.byAcctNum.get(account.toLowerCase());
  if (byAcctNum) return byAcctNum;

  // Try exact name match (case-insensitive)
  const byName = cache.byName.get(account.toLowerCase());
  if (byName) return byName;

  // Try partial FullyQualifiedName match
  const byPartial = cache.items.find(a =>
    a.FullyQualifiedName?.toLowerCase().includes(account.toLowerCase())
  );
  if (byPartial) return byPartial;

  throw new Error(`Account not found: "${account}". Try using account name, number (AcctNum), or ID.`);
}

// Helper to resolve department name to ID using cache
// Accepts: internal ID (e.g., "5"), name (e.g., "20400"), or partial match
export async function resolveDepartmentId(client: QuickBooks, department: string): Promise<string> {
  const cache = await getDepartmentCache(client);

  // Try exact ID match first
  const byId = cache.byId.get(department);
  if (byId) return byId.Id;

  // Try exact name match (case-insensitive)
  const byName = cache.byName.get(department.toLowerCase());
  if (byName) return byName.Id;

  // Try partial/fuzzy match on FullyQualifiedName
  const byPartial = cache.items.find(d =>
    d.FullyQualifiedName?.toLowerCase().includes(department.toLowerCase())
  );
  if (byPartial) return byPartial.Id;

  // If nothing found, return as-is (let API handle error)
  return department;
}
