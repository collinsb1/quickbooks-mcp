// File utilities for report output

import { writeFileSync } from "fs";
import { join } from "path";
import tmp from "tmp";

// Enable automatic cleanup on process exit
tmp.setGracefulCleanup();

// Create session-scoped temp directory (unique per process, 0700 permissions)
const tmpDir = tmp.dirSync({ prefix: "qb-reports-", unsafeCleanup: true });
export const REPORTS_DIR = tmpDir.name;

// Handle signals for graceful cleanup
process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));

export function writeReport(reportType: string, data: unknown): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${reportType}-${timestamp}.json`;
  const filepath = join(REPORTS_DIR, filename);
  writeFileSync(filepath, JSON.stringify(data, null, 2));
  return filepath;
}
