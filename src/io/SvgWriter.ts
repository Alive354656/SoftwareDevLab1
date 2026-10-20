import { randomBytes } from "node:crypto";
import { renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Document } from "../model/Document";

export class SvgWriter {
  write(document: Document, filePath: string): void {
    const temporary = path.join(
      path.dirname(filePath),
      `.${path.basename(filePath)}.${randomBytes(8).toString("hex")}.tmp`,
    );
    try {
      writeFileSync(temporary, document.toSvg(), "utf8");
      renameSync(temporary, filePath);
    } catch (error) {
      this.removeTemporary(temporary);
      throw error;
    }
  }

  // 改名失败时临时文件还在；写都没开始时这里删不到，忽略即可。
  private removeTemporary(temporary: string): void {
    try {
      unlinkSync(temporary);
    } catch {
      return;
    }
  }
}
