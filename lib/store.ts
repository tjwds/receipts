import { promises as fs } from "fs";
import path from "path";

import matter from "gray-matter";

import { parseUnifiedDiff, type DiffFile, type DiffLine } from "@/lib/diff";

export type CheckStatus = "ok" | "warn" | "fail";

export type ReviewStatus = "in_progress" | "complete" | "abandoned";

export interface ReviewMeta {
  slug: string;
  branch: string;
  base: string;
  commit_sha: string;
  base_sha: string;
  status: ReviewStatus;
  started_at: string;
  finished_at?: string;
  title: string;
  author: string;
  author_name?: string;
  repo: string;
  pr_number: number;
  pr_url: string;
  additions: number;
  deletions: number;
  files_changed: number;
  files: string[];
  summary: string;
}

export interface CheckCounts {
  ok: number;
  warn: number;
  fail: number;
}

export interface BlockMeta {
  id: string;
  title: string;
  paths: string[];
  range: [number, number];
  status: CheckStatus;
  parent: string | null;
  counts: CheckCounts;
}

export interface FileGroup {
  path: string;
  blocks: BlockMeta[];
  counts: CheckCounts;
}

export function groupBlocksByFile(
  blocks: BlockMeta[],
  ensureFiles: string[] = [],
): FileGroup[] {
  const map = new Map<string, BlockMeta[]>();

  for (const block of blocks) {
    for (const path of block.paths) {
      const list = map.get(path) ?? [];

      list.push(block);
      map.set(path, list);
    }
  }

  for (const path of ensureFiles) {
    if (!map.has(path)) map.set(path, []);
  }

  const groups: FileGroup[] = [];

  for (const [path, list] of map) {
    const counts: CheckCounts = { ok: 0, warn: 0, fail: 0 };

    for (const block of list) {
      counts.ok += block.counts.ok;
      counts.warn += block.counts.warn;
      counts.fail += block.counts.fail;
    }
    groups.push({ path, blocks: list, counts });
  }

  groups.sort((a, b) => a.path.localeCompare(b.path));

  return groups;
}

export function rollUpStatus(counts: CheckCounts): CheckStatus {
  if (counts.fail > 0) return "fail";
  if (counts.warn > 0) return "warn";
  return "ok";
}

function countChecks(checks: Check[]): CheckCounts {
  const counts: CheckCounts = { ok: 0, warn: 0, fail: 0 };

  for (const check of checks) counts[check.status] += 1;

  return counts;
}

const statusRank: Record<CheckStatus, number> = { ok: 1, warn: 2, fail: 3 };

function worseStatus(a: CheckStatus, b: CheckStatus): CheckStatus {
  return statusRank[a] >= statusRank[b] ? a : b;
}

function hunkStartLine(headerText: string): number {
  const m = headerText.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);

  return m ? parseInt(m[1], 10) : 0;
}

export function mergeBlockDiffsForFile(
  blocks: Block[],
  filePath: string,
): DiffFile | null {
  type Hunk = { startLine: number; lines: DiffLine[] };
  const hunks: Hunk[] = [];
  let isNew = false;

  for (const block of blocks) {
    const files = parseUnifiedDiff(
      block.diff,
      block.paths[0],
      block.range[0],
    );
    const file = files.find((f) => f.path === filePath);

    if (!file) continue;
    if (file.isNew) isNew = true;

    let current: DiffLine[] = [];
    let currentStart = 0;
    const flush = () => {
      if (current.length > 0) {
        hunks.push({ startLine: currentStart, lines: current });
        current = [];
      }
    };

    for (const line of file.lines) {
      const annotated: DiffLine = {
        ...line,
        blockStatus: block.status,
        blockId: block.id,
      };

      if (line.kind === "hunk") {
        flush();
        currentStart = hunkStartLine(line.text);
        current = [annotated];
      } else {
        current.push(annotated);
      }
    }
    flush();
  }

  if (hunks.length === 0) return null;

  hunks.sort((a, b) => a.startLine - b.startLine);

  // Merge adjacent hunks that overlap on lines, taking worst block status.
  const merged: Map<number, DiffLine> = new Map();
  const lines: DiffLine[] = [];

  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.kind === "hunk") {
        lines.push(line);
        continue;
      }
      const key = line.newNum ?? -line.oldNum!;
      const existing = merged.get(key);

      if (existing) {
        existing.blockStatus = worseStatus(
          existing.blockStatus ?? "ok",
          line.blockStatus ?? "ok",
        );
      } else {
        merged.set(key, line);
        lines.push(line);
      }
    }
  }

  return { path: filePath, isNew, lines };
}

function parsePaths(data: { paths?: unknown; path?: unknown }): string[] {
  if (Array.isArray(data.paths)) return data.paths.map(String);
  if (typeof data.path === "string") return [data.path];

  return [];
}

export interface Check {
  status: CheckStatus;
  title: string;
  body: string;
  trailers: Record<string, string>;
}

export interface Block extends BlockMeta {
  intro: string;
  diff: string;
  checks: Check[];
}

export interface BranchChecks {
  title: string;
  intro: string;
  checks: Check[];
  counts: CheckCounts;
}

const RECEIPTS_DIR =
  process.env.RECEIPTS_DIR ?? path.join(process.cwd(), ".receipts");

async function readIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function listReviews(): Promise<ReviewMeta[]> {
  const entries = await fs.readdir(RECEIPTS_DIR, { withFileTypes: true });
  const reviews: ReviewMeta[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const review = await readReviewMeta(entry.name);
    if (review) reviews.push(review);
  }
  reviews.sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
  return reviews;
}

export async function readReviewMeta(slug: string): Promise<ReviewMeta | null> {
  const reviewPath = path.join(RECEIPTS_DIR, slug, "review.md");
  const raw = await readIfExists(reviewPath);
  if (!raw) return null;
  const { data, content } = matter(raw);
  return {
    slug,
    branch: String(data.branch ?? ""),
    base: String(data.base ?? ""),
    commit_sha: String(data.commit_sha ?? ""),
    base_sha: String(data.base_sha ?? ""),
    status: (data.status as ReviewStatus) ?? "in_progress",
    started_at: String(data.started_at ?? ""),
    finished_at: data.finished_at ? String(data.finished_at) : undefined,
    title: String(data.title ?? ""),
    author: String(data.author ?? ""),
    author_name: data.author_name ? String(data.author_name) : undefined,
    repo: String(data.repo ?? ""),
    pr_number: Number(data.pr_number ?? 0),
    pr_url: String(data.pr_url ?? ""),
    additions: Number(data.additions ?? 0),
    deletions: Number(data.deletions ?? 0),
    files_changed: Number(data.files_changed ?? 0),
    files: Array.isArray(data.files) ? data.files.map(String) : [],
    summary: content.trim(),
  };
}

export async function listBlocks(slug: string): Promise<BlockMeta[]> {
  const blocksDir = path.join(RECEIPTS_DIR, slug, "blocks");
  let entries: string[];
  try {
    entries = await fs.readdir(blocksDir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const blocks: BlockMeta[] = [];
  for (const file of entries) {
    if (!file.endsWith(".md")) continue;
    const filePath = path.join(blocksDir, file);
    const raw = await fs.readFile(filePath, "utf8");
    const { data, content } = matter(raw);
    const { checks } = parseBlockBody(content);
    const counts = countChecks(checks);
    blocks.push({
      id: String(data.id ?? ""),
      title: String(data.title ?? ""),
      paths: parsePaths(data),
      range: [Number(data.range?.[0] ?? 0), Number(data.range?.[1] ?? 0)],
      status: rollUpStatus(counts),
      parent: data.parent ? String(data.parent) : null,
      counts,
    });
  }
  blocks.sort((a, b) => a.id.localeCompare(b.id));
  return blocks;
}

export async function readAllBlocks(slug: string): Promise<Block[]> {
  const blocksDir = path.join(RECEIPTS_DIR, slug, "blocks");
  let entries: string[];

  try {
    entries = await fs.readdir(blocksDir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }

  const blocks: Block[] = [];

  for (const file of entries) {
    if (!file.endsWith(".md")) continue;
    const filePath = path.join(blocksDir, file);
    const raw = await fs.readFile(filePath, "utf8");
    const { data, content } = matter(raw);
    const { intro, diff, checks } = parseBlockBody(content);
    const counts = countChecks(checks);

    blocks.push({
      id: String(data.id ?? ""),
      title: String(data.title ?? ""),
      paths: parsePaths(data),
      range: [Number(data.range?.[0] ?? 0), Number(data.range?.[1] ?? 0)],
      status: rollUpStatus(counts),
      parent: data.parent ? String(data.parent) : null,
      counts,
      intro,
      diff,
      checks,
    });
  }

  blocks.sort((a, b) => a.id.localeCompare(b.id));

  return blocks;
}

export async function readBlock(
  slug: string,
  blockId: string,
): Promise<Block | null> {
  const blocksDir = path.join(RECEIPTS_DIR, slug, "blocks");
  const entries = await fs.readdir(blocksDir);
  const file = entries.find((name) => name.startsWith(`${blockId}-`));
  if (!file) return null;
  const raw = await fs.readFile(path.join(blocksDir, file), "utf8");
  const { data, content } = matter(raw);
  const { intro, diff, checks } = parseBlockBody(content);
  const counts = countChecks(checks);
  const meta: BlockMeta = {
    id: String(data.id ?? ""),
    title: String(data.title ?? ""),
    paths: parsePaths(data),
    range: [Number(data.range?.[0] ?? 0), Number(data.range?.[1] ?? 0)],
    status: rollUpStatus(counts),
    parent: data.parent ? String(data.parent) : null,
    counts,
  };

  return { ...meta, intro, diff, checks };
}

export async function readBranchChecks(
  slug: string,
): Promise<BranchChecks | null> {
  const filePath = path.join(RECEIPTS_DIR, slug, "branch-checks.md");
  const raw = await readIfExists(filePath);

  if (!raw) return null;
  const { data, content } = matter(raw);
  const checksHeaderIdx = content.indexOf("\n## Checks");
  let intro = "";
  let rest = content;

  if (checksHeaderIdx !== -1) {
    intro = content.slice(0, checksHeaderIdx).trim();
    rest = content.slice(checksHeaderIdx);
  }

  const checks = parseChecks(rest);
  const counts = countChecks(checks);

  return {
    title: String(data.title ?? "Branch checks"),
    intro,
    checks,
    counts,
  };
}

export async function readBranchDiff(
  slug: string,
  filePath?: string,
): Promise<DiffFile[] | null> {
  const diffPath = path.join(RECEIPTS_DIR, slug, "branch.diff");
  const raw = await readIfExists(diffPath);

  if (!raw) return null;
  const files = parseUnifiedDiff(raw);

  return filePath ? files.filter((f) => f.path === filePath) : files;
}

export async function readRules(): Promise<string | null> {
  const filePath = path.join(RECEIPTS_DIR, "rules.md");
  const raw = await readIfExists(filePath);
  if (!raw) return null;
  return matter(raw).content.trim();
}

function parseBlockBody(body: string): {
  intro: string;
  diff: string;
  checks: Check[];
} {
  const lines = body.split("\n");
  const fence = "```";
  let i = 0;

  const introLines: string[] = [];
  while (i < lines.length && !lines[i].startsWith(`${fence}diff`)) {
    introLines.push(lines[i]);
    i += 1;
  }

  let diff = "";
  if (i < lines.length && lines[i].startsWith(`${fence}diff`)) {
    i += 1;
    const diffLines: string[] = [];
    while (i < lines.length && lines[i] !== fence) {
      diffLines.push(lines[i]);
      i += 1;
    }
    diff = diffLines.join("\n");
    if (i < lines.length) i += 1;
  }

  const rest = lines.slice(i).join("\n");
  const checks = parseChecks(rest);
  return { intro: introLines.join("\n").trim(), diff, checks };
}

function parseChecks(rest: string): Check[] {
  const checks: Check[] = [];
  const sections = rest.split(/\n### /).slice(1);
  for (const section of sections) {
    const headerEnd = section.indexOf("\n");
    const header = section.slice(0, headerEnd).trim();
    const remainder = section.slice(headerEnd + 1);

    const statusMatch = header.match(/^\[([✓⚠✗])\]\s+(.+)$/);
    if (!statusMatch) continue;
    const symbol = statusMatch[1];
    const title = statusMatch[2].trim();
    const status: CheckStatus =
      symbol === "✓" ? "ok" : symbol === "⚠" ? "warn" : "fail";

    const fenceStart = remainder.indexOf("```");
    let body = remainder;
    let trailerBlock = "";
    if (fenceStart !== -1) {
      body = remainder.slice(0, fenceStart);
      const fenceEnd = remainder.indexOf("```", fenceStart + 3);
      trailerBlock = remainder
        .slice(fenceStart + 3, fenceEnd === -1 ? undefined : fenceEnd)
        .trim();
    }

    const trailers: Record<string, string> = {};
    for (const line of trailerBlock.split("\n")) {
      const m = line.match(/^([A-Z][A-Za-z-]+):\s*(.*)$/);
      if (m) trailers[m[1]] = m[2].trim();
    }

    checks.push({ status, title, body: body.trim(), trailers });
  }
  return checks;
}
