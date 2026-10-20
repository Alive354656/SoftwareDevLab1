import { TreeNode } from "./TreeNode";

interface TreeLine {
  readonly prefix: string;
  readonly label: string;
  readonly detail: string;
}

export class TreeText {
  static render(root: TreeNode): string {
    const lines: TreeLine[] = [];
    this.collect(root, "", "", lines);
    return this.align(lines);
  }

  private static collect(
    node: TreeNode,
    linePrefix: string,
    childBase: string,
    lines: TreeLine[],
  ): void {
    lines.push({ prefix: linePrefix, label: node.label, detail: node.detail });
    node.children.forEach((child, index) => {
      const last = index === node.children.length - 1;
      const branch = last ? "└── " : "├── ";
      const nextBase = childBase + (last ? "    " : "│   ");
      this.collect(child, childBase + branch, nextBase, lines);
    });
  }

  // 列号只看 detail 非空的行：max(前缀长度 + 标签长度) + 2。
  private static align(lines: readonly TreeLine[]): string {
    let width = 0;
    for (const line of lines) {
      if (line.detail !== "") {
        width = Math.max(width, line.prefix.length + line.label.length);
      }
    }
    const column = width + 2;
    return lines
      .map(line => {
        if (line.detail === "") {
          return line.prefix + line.label;
        }
        const spaces = column - line.prefix.length - line.label.length;
        return line.prefix + line.label + " ".repeat(spaces) + line.detail;
      })
      .join("\n");
  }
}
