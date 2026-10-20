export class TreeNode {
  constructor(
    readonly label: string,
    readonly detail: string,
    readonly children: readonly TreeNode[],
  ) {}
}
