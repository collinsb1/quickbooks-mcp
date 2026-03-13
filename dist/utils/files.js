// File utilities for report output
import { writeFileSync } from "fs";
import { join } from "path";
import tmp from "tmp";
// Enable automatic cleanup on process exit
tmp.setGracefulCleanup();
// Lazy temp directory — only created on first writeReport() call
let reportsDir = null;
function getReportsDir() {
    if (!reportsDir) {
        const tmpDir = tmp.dirSync({ prefix: "qb-reports-", unsafeCleanup: true });
        reportsDir = tmpDir.name;
    }
    return reportsDir;
}
// Handle signals for graceful cleanup
process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
export function writeReport(reportType, data) {
    const dir = getReportsDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${reportType}-${timestamp}.json`;
    const filepath = join(dir, filename);
    writeFileSync(filepath, JSON.stringify(data, null, 2));
    return filepath;
}
//# sourceMappingURL=files.js.map