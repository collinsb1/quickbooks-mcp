export type OutputMode = "stdio" | "http";
export declare function setOutputMode(mode: OutputMode): void;
export declare function isHttpMode(): boolean;
type ToolResult = {
    content: Array<{
        type: string;
        text: string;
    }>;
};
/**
 * Return report data in the appropriate format for the current transport.
 * - stdio: writes to temp file, appends filepath to summary
 * - http: returns summary + inline JSON data
 */
export declare function outputReport(reportType: string, data: unknown, summary: string): ToolResult;
export {};
//# sourceMappingURL=output.d.ts.map