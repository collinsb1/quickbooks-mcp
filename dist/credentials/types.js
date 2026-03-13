// Credential provider types for QuickBooks OAuth management
/**
 * Get credential mode from environment
 * Defaults to "local" if not specified
 */
export function getCredentialMode() {
    const mode = process.env.QBO_CREDENTIAL_MODE?.toLowerCase();
    if (mode === "aws") {
        return "aws";
    }
    return "local";
}
//# sourceMappingURL=types.js.map