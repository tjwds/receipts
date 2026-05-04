export type DiffLineKind = "add" | "del" | "ctx" | "hunk" | "file";

export type DiffLineStatus = "ok" | "warn" | "fail";

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
  oldNum?: number;
  newNum?: number;
  blockStatus?: DiffLineStatus;
  blockId?: string;
}

export interface DiffFile {
  path: string;
  isNew: boolean;
  lines: DiffLine[];
}

export function parseUnifiedDiff(diff: string): DiffFile[] {
  const lines = diff.split("\n");
  const files: DiffFile[] = [];
  let current: DiffFile | null = null;
  let oldNum = 0;
  let newNum = 0;
  let inHunk = false;

  for (const line of lines) {
    if (line.startsWith("diff --git")) {
      if (current) files.push(current);
      const match = line.match(/ b\/(.+)$/);
      current = { path: match?.[1] ?? "(unknown)", isNew: false, lines: [] };
      inHunk = false;
      continue;
    }
    if (!current) {
      current = { path: "(unknown)", isNew: false, lines: [] };
    }
    if (line.startsWith("new file mode")) {
      current.isNew = true;
      continue;
    }
    if (
      line.startsWith("index ") ||
      line.startsWith("--- ") ||
      line.startsWith("+++ ")
    ) {
      continue;
    }
    if (line.startsWith("@@")) {
      const match = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldNum = parseInt(match[1], 10);
        newNum = parseInt(match[2], 10);
      }
      current.lines.push({ kind: "hunk", text: line });
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;
    if (line.startsWith("+")) {
      current.lines.push({
        kind: "add",
        text: line.slice(1),
        newNum: newNum,
      });
      newNum += 1;
    } else if (line.startsWith("-")) {
      current.lines.push({
        kind: "del",
        text: line.slice(1),
        oldNum: oldNum,
      });
      oldNum += 1;
    } else {
      current.lines.push({
        kind: "ctx",
        text: line.startsWith(" ") ? line.slice(1) : line,
        oldNum: oldNum,
        newNum: newNum,
      });
      oldNum += 1;
      newNum += 1;
    }
  }

  if (current) files.push(current);
  return files;
}
