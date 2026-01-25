// Cache types for account and department lookups

export interface CachedDepartment {
  Id: string;
  Name: string;
  FullyQualifiedName?: string;
}

export interface CachedAccount {
  Id: string;
  Name: string;
  FullyQualifiedName?: string;
  AcctNum?: string;
  AccountType?: string;
  CurrentBalance?: number;
  Active?: boolean;
}

export interface DepartmentCache {
  items: CachedDepartment[];
  byId: Map<string, CachedDepartment>;
  byName: Map<string, CachedDepartment>;  // lowercase key
  fetchedAt: number;
}

export interface AccountCache {
  items: CachedAccount[];
  byId: Map<string, CachedAccount>;
  byName: Map<string, CachedAccount>;      // lowercase key
  byAcctNum: Map<string, CachedAccount>;   // lowercase key
  fetchedAt: number;
}
