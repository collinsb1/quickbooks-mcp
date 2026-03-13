import OAuthClient from "intuit-oauth";
import type { QBCredentials } from "./types.js";
/**
 * Create an OAuth client instance with client credentials
 */
export declare function createOAuthClient(clientId: string, clientSecret: string): OAuthClient;
/**
 * Generate the authorization URL for OAuth flow
 * User visits this URL to authorize the app
 */
export declare function generateAuthorizationUrl(clientId: string, clientSecret: string): string;
/**
 * Result of exchanging an authorization code for tokens
 */
export interface TokenExchangeResult {
    credentials: QBCredentials;
    companyId: string;
}
/**
 * Exchange authorization code for access and refresh tokens
 */
export declare function exchangeCodeForTokens(clientId: string, clientSecret: string, authorizationCode: string, realmId: string): Promise<TokenExchangeResult>;
/**
 * Refresh access token using a refresh token
 */
export declare function refreshAccessToken(credentials: QBCredentials): Promise<QBCredentials>;
/**
 * Get instructions for the OAuth flow
 */
export declare function getOAuthInstructions(authUrl: string): string;
//# sourceMappingURL=oauth-client.d.ts.map