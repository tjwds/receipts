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

export function parseUnifiedDiff(
  diff: string,
  defaultPath?: string,
  defaultStartLine?: number,
): DiffFile[] {
  const lines = diff.split("\n");
  const files: DiffFile[] = [];
  let current: DiffFile | null = null;
  let oldNum = 0;
  let newNum = 0;
  let inHunk = false;

  const looksLikeDiffLine = (line: string) =>
    line.startsWith("+") ||
    line.startsWith("-") ||
    (line.startsWith(" ") && line.length > 0);

  for (const line of lines) {
    if (line.startsWith("diff --git")) {
      if (current) files.push(current);
      const match = line.match(/ b\/(.+)$/);
      current = { path: match?.[1] ?? "(unknown)", isNew: false, lines: [] };
      inHunk = false;
      continue;
    }
    if (!current) {
      current = {
        path: defaultPath ?? "(unknown)",
        isNew: false,
        lines: [],
      };
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
    // Tolerate diffs that are missing a `@@ ... @@` hunk header: if we see
    // diff-like content while not in a hunk, synthesize one so line numbers
    // and gutter rendering still work.
    if (!inHunk && looksLikeDiffLine(line)) {
      const start = defaultStartLine ?? 1;

      oldNum = start;
      newNum = start;
      current.lines.push({ kind: "hunk", text: "@@" });
      inHunk = true;
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
