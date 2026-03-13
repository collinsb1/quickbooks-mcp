import { createRemoteJWKSet, jwtVerify } from "jose";
/**
 * Read auth config from environment variables.
 * Returns null if required vars aren't set (auth disabled).
 */
export function getAuthConfig() {
    const jwksUri = process.env.MCP_AUTH_JWKS_URI;
    const audience = process.env.MCP_AUTH_AUDIENCE;
    const issuer = process.env.MCP_AUTH_ISSUER;
    if (!jwksUri || !audience || !issuer) {
        return null;
    }
    // Azure AD v1 tokens use sts.windows.net issuer, v2 uses login.microsoftonline.com.
    // Accept both by extracting the tenant ID and building both issuer URLs.
    const tenantMatch = issuer.match(/([0-9a-f-]{36})/);
    const issuers = tenantMatch
        ? [
            `https://login.microsoftonline.com/${tenantMatch[1]}/v2.0`,
            `https://sts.windows.net/${tenantMatch[1]}/`,
        ]
        : [issuer];
    return {
        jwksUri,
        audience,
        issuers,
        requiredScope: process.env.MCP_AUTH_SCOPE,
    };
}
// JWKS keyset — cached at module level across warm Lambda invocations.
// jose handles key rotation automatically.
let jwksCache = null;
function getJWKS(jwksUri) {
    if (!jwksCache || jwksCache.uri !== jwksUri) {
        jwksCache = {
            uri: jwksUri,
            keyset: createRemoteJWKSet(new URL(jwksUri)),
        };
    }
    return jwksCache.keyset;
}
/**
 * Validate a Bearer JWT token against the configured JWKS, audience, issuer,
 * and optionally a required scope.
 */
export async function validateToken(token, config) {
    try {
        const jwks = getJWKS(config.jwksUri);
        const { payload } = await jwtVerify(token, jwks, {
            audience: config.audience,
            issuer: config.issuers,
        });
        // Check required scope if configured
        if (config.requiredScope) {
            const scp = payload.scp;
            const scopes = Array.isArray(scp) ? scp : typeof scp === "string" ? scp.split(" ") : [];
            if (!scopes.includes(config.requiredScope)) {
                return { valid: false, error: `Missing required scope: ${config.requiredScope}` };
            }
        }
        return { valid: true, claims: payload };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { valid: false, error: message };
    }
}
//# sourceMappingURL=token-validator.js.map