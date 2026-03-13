export interface AuthConfig {
    jwksUri: string;
    audience: string;
    issuers: string[];
    requiredScope?: string;
}
/**
 * Read auth config from environment variables.
 * Returns null if required vars aren't set (auth disabled).
 */
export declare function getAuthConfig(): AuthConfig | null;
export type TokenResult = {
    valid: true;
    claims: Record<string, unknown>;
} | {
    valid: false;
    error: string;
};
/**
 * Validate a Bearer JWT token against the configured JWKS, audience, issuer,
 * and optionally a required scope.
 */
export declare function validateToken(token: string, config: AuthConfig): Promise<TokenResult>;
//# sourceMappingURL=token-validator.d.ts.map