import QuickBooks from "node-quickbooks";
import { CachedAccount, CachedEntity, AccountCache, ClassCache, DepartmentCache, VendorCache, EntityCache } from "../types/index.js";
export declare function clearLookupCache(): void;
export declare function getDepartmentCache(client: QuickBooks): Promise<DepartmentCache>;
export declare function getClassCache(client: QuickBooks): Promise<ClassCache>;
export declare function getAccountCache(client: QuickBooks): Promise<AccountCache>;
export declare function resolveAccount(client: QuickBooks, account: string): Promise<CachedAccount>;
export declare function getVendorCache(client: QuickBooks): Promise<VendorCache>;
export declare function resolveVendor(client: QuickBooks, nameOrId: string): Promise<{
    value: string;
    name: string;
}>;
export declare function resolveItem(client: QuickBooks, nameOrId: string): Promise<{
    value: string;
    name: string;
}>;
export declare function resolveDepartmentId(client: QuickBooks, department: string): Promise<string>;
export declare function resolveClassId(client: QuickBooks, cls: string): Promise<string>;
export declare function resolveCustomer(client: QuickBooks, nameOrId: string): Promise<{
    value: string;
    name: string;
}>;
export declare function getEntityCache(client: QuickBooks): Promise<EntityCache>;
export type EntityMatchResult = {
    kind: 'exact';
    entity: CachedEntity;
} | {
    kind: 'fuzzy';
    candidates: CachedEntity[];
} | {
    kind: 'none';
};
export declare function resolveEntityName(client: QuickBooks, nameOrId: string): Promise<EntityMatchResult>;
//# sourceMappingURL=cache.d.ts.map