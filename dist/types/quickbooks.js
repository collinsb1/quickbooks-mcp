// QuickBooks report and transaction types
// Type guard for QB error objects (handles both casings)
export function isQBError(error) {
    if (typeof error !== 'object' || error === null)
        return false;
    const err = error;
    // Check capitalized (actual QB API)
    if (err.Fault && typeof err.Fault === 'object') {
        const fault = err.Fault;
        if (Array.isArray(fault.Error))
            return true;
    }
    // Check lowercase (node-quickbooks legacy)
    if (err.fault && typeof err.fault === 'object') {
        const fault = err.fault;
        if (Array.isArray(fault.error))
            return true;
    }
    return false;
}
// Extract normalized error info from a QB error (casing-safe)
export function extractQBErrorInfo(error) {
    const errors = error.Fault?.Error ?? error.fault?.error;
    if (!errors || errors.length === 0)
        return {};
    const first = errors[0];
    return {
        code: first.Code ?? first.code,
        message: first.Message ?? first.message,
        detail: first.Detail ?? first.detail,
    };
}
//# sourceMappingURL=quickbooks.js.map