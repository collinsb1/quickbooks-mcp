import type { CredentialProvider, QBCredentials } from "./types.js";
/**
 * Local file-based credential provider
 * Stores credentials in ~/.quickbooks-mcp/credentials.json by default
 */
export declare class LocalCredentialProvider implements CredentialProvider {
    private credentialPath;
    constructor();
    getCredentials(): Promise<QBCredentials>;
    saveCredentials(credentials: QBCredentials): Promise<void>;
    getCompanyId(): Promise<string>;
    isConfigured(): Promise<boolean>;
    /**
     * Check if client credentials are available (for OAuth flow)
     * Client ID and secret can come from env vars or stored file
     */
    hasClientCredentials(): Promise<boolean>;
    /**
     * Get client credentials for OAuth flow
     * Returns null if not available
     */
    getClientCredentials(): Promise<{
        clientId: string;
        clientSecret: string;
    } | null>;
}
//# sourceMappingURL=local-provider.d.ts.map