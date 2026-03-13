type ToolResult = {
    content: Array<{
        type: string;
        text: string;
    }>;
    isError?: boolean;
};
interface AuthenticateArgs {
    authorization_code?: string;
    realm_id?: string;
}
/**
 * Handle the qbo_authenticate tool
 * This tool does NOT require a QuickBooks client - it's used to set up credentials
 */
export declare function handleAuthenticate(args: AuthenticateArgs): Promise<ToolResult>;
export {};
//# sourceMappingURL=authenticate.d.ts.map