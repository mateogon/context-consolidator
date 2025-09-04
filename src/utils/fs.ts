// src/utils/fs.ts
import * as fs from "fs/promises";

export async function isBinaryUri(fsPath: string): Promise<boolean> {
  try {
    const buf = await fs.readFile(fsPath);
    return buf.subarray(0, 8192).includes(0);
  } catch {
    return true;
  }
}
