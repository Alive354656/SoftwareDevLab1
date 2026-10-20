const DESCRIPTION_COLUMN = 42;

const ROWS: readonly (readonly [string, string])[] = [
  ["init [w] [h]", "create a canvas (default 800x600)"],
  ["read <file.svg>", "load an SVG file"],
  ["save [file.svg]", "save the document"],
  ["canvas [w] [h]", "show or resize the canvas"],
  ["create <type> <id> [params...] [in <id>]", "create a shape"],
  ["delete <id>", "delete a shape"],
  ["move <id> <dx> <dy>", "move by a delta"],
  ["scale <id> <factor>", "scale geometry by a positive factor"],
  ["set <id> <attr> <value>", "set an attribute"],
  ["group <newGid> <id1> <id2>...", "group existing shapes"],
  ["ungroup <gid>", "dissolve a nested group"],
  ["addto <gid> <id>", "move a shape into a group"],
  ["front <id>", "bring to front within the parent"],
  ["back <id>", "send to back within the parent"],
  ["tree [id]", "print the structure tree"],
  ["show <id>", "print one shape"],
  ["help", "show this help"],
  ["undo", "undo the last edit"],
  ["redo", "redo the last undone edit"],
];

export class HelpText {
  static readonly body: string = ROWS.map(([syntax, description]) => {
    const spaces = DESCRIPTION_COLUMN - syntax.length;
    return syntax + " ".repeat(spaces) + description;
  }).join("\n");
}
