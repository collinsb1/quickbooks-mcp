export type { QBCredentials, CredentialProvider, CredentialMode } from "./types.js";
export { getCredentialMode } from "./types.js";
export { AWSCredentialProvider } from "./aws-provider.js";
export { LocalCredentialProvider } from "./local-provider.js";
import type { CredentialProvider } from "./types.js";
/**
 * Get the credential provider based on QBO_CREDENTIAL_MODE environment variable
 * - "aws": Uses AWS Secrets Manager and SSM Parameter Store
 * - "local" (default): Uses local file storage at ~/.quickbooks-mcp/credentials.json
 */
export declare function getCredentialProvider(): CredentialProvider;
/**
 * Clear the cached provider instance (for testing or credential mode changes)
 */
export declare function clearProviderCache(): void;
/**
 * Check if we're using local credential mode
 */
export declare function isLocalMode(): boolean;
/**
 * Check if we're using AWS credential mode
 */
export declare function isAWSMode(): boolean;
//# sourceMappingURL=index.d.ts.map