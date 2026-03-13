// Output mode utilities for stdio vs HTTP transport
// In stdio mode: write full data to temp files, return filepath reference
// In HTTP mode: return data inline (no filesystem access in Lambda)
import { writeReport } from "./files.js";
let currentOutputMode = "stdio";
export function setOutputMode(mode) {
    currentOutputMode = mode;
}
export function isHttpMode() {
    return currentOutputMode === "http";
}
/**
 * Return report data in the appropriate format for the current transport.
 * - stdio: writes to temp file, appends filepath to summary
 * - http: returns summary + inline JSON data
 */
export function outputReport(reportType, data, summary) {
    if (isHttpMode()) {
        return {
            content: [
                { type: "text", text: summary },
                { type: "text", text: JSON.stringify(data) },
            ],
        };
    }
    const filepath = writeReport(reportType, data);
    return {
        content: [{ type: "text", text: `${summary}\n\nFull data: ${filepath}` }],
    };
}
//# sourceMappingURL=output.js.map