import type { CredentialProvider, QBCredentials } from "./types.js";
/**
 * AWS-based credential provider
 * Stores credentials in Secrets Manager and company ID in SSM Parameter Store
 */
export declare class AWSCredentialProvider implements CredentialProvider {
    private secretsClient;
    private ssmClient;
    private cachedCompanyId;
    constructor();
    getCredentials(): Promise<QBCredentials>;
    saveCredentials(credentials: QBCredentials): Promise<void>;
    getCompanyId(): Promise<string>;
    isConfigured(): Promise<boolean>;
}
export declare function getSecret(): Promise<QBCredentials>;
export declare function putSecret(credentials: QBCredentials): Promise<void>;
export declare function getCompanyId(): Promise<string>;
//# sourceMappingURL=aws-provider.d.ts.map