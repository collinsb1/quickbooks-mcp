// Credential provider factory and exports
export { getCredentialMode } from "./types.js";
export { AWSCredentialProvider } from "./aws-provider.js";
export { LocalCredentialProvider } from "./local-provider.js";
import { getCredentialMode } from "./types.js";
import { AWSCredentialProvider } from "./aws-provider.js";
import { LocalCredentialProvider } from "./local-provider.js";
// Singleton provider instance
let providerInstance = null;
/**
 * Get the credential provider based on QBO_CREDENTIAL_MODE environment variable
 * - "aws": Uses AWS Secrets Manager and SSM Parameter Store
 * - "local" (default): Uses local file storage at ~/.quickbooks-mcp/credentials.json
 */
export function getCredentialProvider() {
    if (!providerInstance) {
        const mode = getCredentialMode();
        if (mode === "aws") {
            providerInstance = new AWSCredentialProvider();
        }
        else {
            providerInstance = new LocalCredentialProvider();
        }
    }
    return providerInstance;
}
/**
 * Clear the cached provider instance (for testing or credential mode changes)
 */
export function clearProviderCache() {
    providerInstance = null;
}
/**
 * Check if we're using local credential mode
 */
export function isLocalMode() {
    return getCredentialMode() === "local";
}
/**
 * Check if we're using AWS credential mode
 */
export function isAWSMode() {
    return getCredentialMode() === "aws";
}
//# sourceMappingURL=index.js.map