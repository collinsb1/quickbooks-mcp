export { toolDefinitions } from "./definitions.js";
type ToolResult = {
    content: Array<{
        type: string;
        text: string;
    }>;
    isError?: boolean;
};
export declare function executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult>;
//# sourceMappingURL=index.d.ts.map