// URL generation utilities for QuickBooks Online

const URL_MAP: Record<string, string> = {
  journalentry: "journal",
  purchase: "expense",
  deposit: "deposit",
  salesreceipt: "salesreceipt",
  bill: "bill",
  invoice: "invoice",
  payment: "payment",
};

export function getQboUrl(entityType: string, id: string): string | null {
  const path = URL_MAP[entityType.toLowerCase()];
  return path ? `https://app.qbo.intuit.com/app/${path}?txnId=${id}` : null;
}
