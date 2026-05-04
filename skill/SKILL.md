---
name: receipts
description: Review a git branch as a careful senior engineer would, recording evidence block-by-block into a structured local store that the receipts viewer renders as an evidence ledger. Invoke when the user asks to "review", "look at", "do receipts on", or "check" a branch / PR, or asks to drill into a specific block, re-check something, or update the repo's review rules.
---

# /receipts

You are reviewing a git branch the way a careful, senior engineer would, working through the diff block by block and recording evidence as you go. The output is a directory of files in `.receipts/<branch-slug>/` that the receipts UI renders as a structured evidence ledger. The point of receipts isn't to find bugs (though you might) — it's to **make it safe to skim agent-authored code**, by encoding the discipline of "what would a careful reviewer check on this block?" as a tangible artifact.

## The model

A **block is a coherent line range in a file** (or parallel ranges across files for a cross-cutting change). The block IS its lines. **Checks are commentary on that range** — not on sub-ranges within it. If you find yourself wanting to write "this check is about lines 88–90 of this 50-line block," that's a sign the block should have been smaller. Make a new block.

Per-block status is **derived** from its checks (worst-wins): any `✗` ⇒ block is `fail`; any `⚠` ⇒ `warn`; otherwise `ok`. Don't set block status manually.

The verified policy is **lenient**:

- `[✓]` — you ran the check (read, grep, ran a test, compared, etc.) and it looks good.
- `[⚠]` — uncertainty, or something worth surfacing for human attention. Default for ambiguity.
- `[✗]` — clear failure, or a behavior change material enough that it deserves to halt the reviewer's eye. Reserve for things you'd want flagged in red on a real PR.

You don't need doctorate-level rigor. The discipline is *did a check happen and is the evidence captured*.

## When invoked

Common user requests this skill handles:

| User says | What you do |
|---|---|
| "review this branch / PR" | Full workflow below: read the diff, decompose into blocks, write checks, write branch-level checks (CI + design observations). |
| "what about block N" | Read `.receipts/<slug>/blocks/<N>-*.md`, summarize, answer the user's question, possibly drill in further. |
| "re-check block N" | Re-run verifications for that block. Update the file in place. |
| "split block N" | Split a too-large block into smaller, focused ones. Renumber subsequent blocks if needed. |
| "update our rules to always check X" | Append to `.receipts/rules.md`. Cite where you'd apply the new rule. |
| "mark block N as ⚠ because Y" | Override: change a check status (or add a new check) with the user's reason as the body. |

## Workflow: reviewing a branch

Run these in order. Use `git` and the file tools — there is no separate API.

### 1. Set up the store

```bash
mkdir -p .receipts/<branch-slug>/blocks
```

`<branch-slug>` is the branch name with `/` replaced by `-` (e.g. `feature/add-auth` → `feature-add-auth`).

If `.receipts/<branch-slug>/.lock` exists, another review is in progress. Stop and surface this to the user.

### 2. Gather the facts

- `git log -1 --format=%H` and the base SHA (default base: `main`, but check `git merge-base HEAD <base>`).
- `git diff <base>..HEAD --name-only` for the file list.
- `git log <base>..HEAD --format='%H %s' --reverse` for the commit list.
- `gh pr view <branch>` if a PR exists, for title / body / author.

Then save the full diff to `.receipts/<branch-slug>/branch.diff`:

```bash
git diff <base>..HEAD > .receipts/<branch-slug>/branch.diff
```

This is the source of truth for the file diff in the viewer, including for files you don't end up writing blocks for. (Files in `review.md`'s `files:` list with no blocks still render their diff in the UI from this file.)

### 3. Read `.receipts/rules.md`

Repo-level rules the user has accumulated. Apply them to every block alongside per-block checks the diff suggests. If `rules.md` doesn't exist yet, generate a starter version from the project's stack (e.g., for a Python repo: "always check that new functions have type hints"; for a Next.js repo: "always check that server-only code isn't imported into a client component").

### 4. Write `review.md`

Frontmatter (YAML), then a brief prose summary. Block list is *derived* from `blocks/` — don't track it here.

```yaml
---
branch: feature/add-auth
base: main
commit_sha: <head sha>
base_sha: <base sha>
status: in_progress    # set to `complete` when finished
started_at: 2026-05-04T19:00:00Z
finished_at:           # filled in at the end
title: "<PR title>"
author: <login>
author_name: <full name>
repo: org/repo
pr_number: 42
pr_url: https://...
additions: 120
deletions: 38
files_changed: 4
files:                 # every path in the branch's diff, even ones you don't write blocks for
  - src/auth/session.ts
  - src/api/login.ts
  - ...
---

<one-paragraph plain-language summary of the change>
```

### 5. Decompose the diff into blocks

Walk file by file. For each file, identify the coherent units of change. **A block is one logical change**, not one hunk and not one file. Examples of good block boundaries:

- A single function rewrite — one block, even if it touches 30 lines.
- A header-comment update — one block.
- A migration up/down pair — one block (the two halves are a single logical unit).
- A renamed identifier propagated through 5 files — one block (cross-file, see below), even though it's small in each location.
- A repeated mechanical change applied to N parallel files — one cross-file block, not N blocks.

Examples of *bad* block boundaries:

- "Everything in `foo.ts`" — almost always wrong. A file with 100+ lines changed virtually never represents one logical change.
- A block that spans both a header-comment rewrite and a function body change in the same file — two unrelated changes that happen to live near each other; split them.
- "Lines 1–10" with no logical justification — the boundary should follow meaning, not line numbers.
- "Just the import change" — too granular if the import is part of a larger feature in the same file.

Rules of thumb:

- **Prefer smaller blocks.** A typical block covers 5–50 changed lines. If you're at 100+ lines for one block, you're almost certainly merging multiple unrelated logical changes — split until each block is one thing the reviewer can hold in their head at once.
- **Expect multiple blocks per file.** If a file has more than a handful of lines changed, it almost always contains more than one logical change. A 200-line dbt model change with 1 block is a code smell; 4 blocks of ~50 lines each is closer to the norm.
- **One block, one verdict.** If you find yourself wanting half the block green and half red, split it.
- **One block, one topic.** If the block's title needs an "and" (e.g., "header rewrite *and* CASE removal"), it's two blocks.
- **Every changed line should be inside at least one block.** Files with no blocks are fine if the diff in that file is purely cosmetic; they appear in the sidebar as "not reviewed."
- **Parent blocks** are a thing for file-level attestations ("no new dependencies in this file", "no secrets") that span the whole file. Use the `parent` field to nest sub-blocks.

### 6. For each block, write `blocks/NNNN-<slug>.md`

Pad the id to 4 digits (`0001`, `0002`...). Slug is a kebab-case description of the block.

```markdown
---
id: "0002"
title: "chargeUser: argument validation moved to a typed request object"
paths:
  - src/billing/charge.ts
range: [12, 48]
parent: null
---

<one-paragraph intro: what is this block doing, in plain terms?>

```diff
@@ -12,8 +12,18 @@ class Billing {
   // ...embedded unified diff for ONLY this block's lines goes here.
}
```

## Checks

### [✓] Type signature matches every call site

Every caller of `chargeUser` was updated to construct a `ChargeRequest` rather than spread an untyped object: confirmed via grep at `src/api/checkout.ts:42` and `src/cron/recharge.ts:88`. No drift between the new signature and its callers.

```
Verified-by: claude-code@<short sha of HEAD>
Method: grep callers + read each call site
```

### [⚠] <next check title>
...
```

### Diff formatting inside the block file

The embedded diff is rendered as the file's slice in the viewer. Hunk headers (`@@ -<old>,<oldcount> +<new>,<newcount> @@`) are **required** for line numbers to render correctly. Two cases for the file header:

- **Single-file block** (`paths: [one/file]`): just include the `@@ ... @@` hunks. The viewer infers the path from `paths[0]`. No `diff --git` header is required.
- **Cross-file block** (`paths: [a, b, ...]`): include a `diff --git a/<path> b/<path>` header above each file's hunks. Without these headers, every hunk is attributed to `paths[0]` and rendering for the other paths breaks. The cleanest source for both cases is `git diff <base>..HEAD -- <path>` — copy the hunks from there.

### Cross-file blocks

Use `paths: [a, b, c]` when the same logical change touches multiple files in parallel (e.g., a renamed type propagated to its callers, or a mechanical update applied identically across several configuration files). Include `diff --git` headers per file as noted above. The viewer renders only the slice for whichever file the user is currently viewing.

The `range: [start, end]` is approximate for cross-file blocks — use a representative range that applies to most files. If the ranges differ wildly per file, that's a sign the block is heterogenous and probably should be split.

### 7. Write `branch-checks.md`

Branch-level checks use the same `### [✓|⚠|✗] Title` format as block checks. They cover two things: **CI status** (one check per CI job, status reflecting pass/fail/in-progress) and **branch-level observations** that only make sense when you've held the whole branch in your head.

Frontmatter is just `title`. Optional intro paragraph above the `## Checks` header.

Run `gh pr checks <pr_number>` for CI status — one branch check per job. Map `pass` → `✓`, `fail` → `✗`, `in_progress` / `pending` / `skipped` → `⚠` (or omit if you'd rather not surface noise). Trailer should include the run URL as `Source:`.

Branch-level observation topics, when they apply:

- **Matches the linked ticket / issue.** If the branch has an associated task in the team's task tracker (Linear, Jira, GitHub Issues, ZenHub, Shortcut, Asana, Trello, etc.), find the link — usually in the PR description, the branch name, or a commit trailer — and read the ticket. Then check the implementation against what the ticket actually asked for: does it solve the stated problem, does it leave parts unaddressed, does it do more than was asked? Flag scope creep and scope gaps as `⚠`; flag a clear miss (e.g., the ticket asks for behavior X and the branch implements behavior Y) as `✗`. If you can't find a linked ticket, say so in the check body and mark `⚠` — the absence of a ticket is itself worth surfacing.
- **Pattern followed** — does this branch match an existing pattern, or invent a new one? Cite the precedent.
- **Consistency** — was the change applied uniformly where it should have been? Anywhere it should have but didn't?
- **Intentional asymmetry** — places where the branch deliberately deviates from a parallel pattern, with reasoning. These often warrant `⚠` even when correct, because the asymmetry is easy to misread later.
- **New abstractions** — overlap with existing code? Misnaming risk?
- **Sites that probably should have changed but didn't** — surface these by name.
- **Watch-outs** — silent breaking changes, deferred follow-ups, things that need a TODO. Often `⚠`; sometimes `✗` if the change is breaking enough.

Each branch check has a status, body, and trailers — same shape as a block check. Be specific. Cite files and line ranges in the body when relevant; the trailer captures method, not location.

Branch checks are NOT where you summarize the PR — that's `review.md`. They are where you flag the things only a reviewer who held the whole branch in their head would notice, plus the operational signal (CI) the human needs in one place.

### 8. Self-check before declaring complete

Before marking the review `complete`, walk through this checklist. The viewer is forgiving but not magic; broken inputs produce blank pages.

- **`branch.diff` exists and is non-empty.** `wc -l .receipts/<slug>/branch.diff` should be > 0.
- **`review.md` frontmatter has every field**, especially `files:` (the canonical list) and the SHAs. The block list is *derived* from `blocks/` — don't hand-maintain it.
- **Every block file's `paths:` list is a subset of `review.md`'s `files:`.** A block whose path isn't in `files:` will appear nowhere in the sidebar. Quickest check: `for f in blocks/*.md; do head -10 "$f"; done | grep -A2 paths:` and eyeball.
- **Every block's embedded diff has at least one `@@ ... @@` hunk header.** Without it, the gutter can't show line numbers and the rendered diff is empty. The cleanest source is `git diff <base>..HEAD -- <path>` — copy the hunks from there. If the block is single-file, the `diff --git` header is optional; if cross-file, it's required so the viewer can attribute hunks to files.
- **Every block has at least one `### [✓|⚠|✗] ...` check.** Blocks with zero checks render as empty cards.
- **`branch-checks.md` exists** with at least the CI status reflected as `### [✓|✗] CI: <job> ...` (one per `gh pr checks <pr>` row), plus any branch-level observations. Zero branch checks means the user has no signal that a CI job ran.
- **Status: `complete`.** Set `status: complete` in `review.md` and fill in `finished_at`. Don't leave a finished review marked `in_progress`.

If the user has the viewer running with `RECEIPTS_DIR` pointed at the target repo, hit each file route in the browser and confirm the diff and block cards render. A blank file page is the canonical symptom of one of the failures above.

### 9. Wrap up

- Write a one-line completion message to the user with the path to the rendered view (`http://localhost:<port>/r/<slug>` if the viewer is running).

## Writing good checks

A check has four parts:

```markdown
### [<status>] <title — single declarative sentence>

<body — 1-3 paragraphs of evidence prose, citing concretes>

`​`​`
Verified-by: <agent-id>@<short sha>
Method: <how you checked, in 4-8 words>
Source: <prose citation if applicable — file paths, PR section names, RFC numbers>
`​`​`
```

### Title

A declarative sentence in title case, leading with the *property being checked*, not the activity. The reader should be able to read just the title and know what the check is about.

| Bad | Good |
|---|---|
| Checked the macro | Display labels match the legacy CASE statement output |
| Looking at error handling | Error path is reachable and uses the project's standard wrapper |
| Reviewed the migration | Migration is reversible with a documented down-step |

### Body

What you found. Be concrete:

- Cite line numbers, function names, file paths.
- For comparisons (pre-change vs. post-change), say what was there and what's there now.
- For potential issues, say *what would go wrong* and *for whom*.

Don't editorialize. State what's there. Let the status (`✓` / `⚠` / `✗`) carry the verdict.

### Trailers

`Verified-by:` and `Method:` are required. `Source:` is optional, used when you cited an external reference (a spec, a PR comment, an RFC). Don't put line ranges in `Source:` — the block's range is already the scope.

The `Method:` field is the most useful trailer for the human reader: a four-to-eight-word phrase that says how you checked. Examples:

- `read + grep within file`
- `pre-change vs. post-change comparison`
- `ran test suite`
- `cross-file pattern comparison`
- `type-flow analysis`
- `read + cross-check with PR description`

Avoid empty methods like `manual review` — say what you actually did.

## Per-repo rules (`rules.md`)

`.receipts/rules.md` is repo-level guidance the user has accumulated. It feeds into every block's check generation. Treat it as user-authored — don't reformat or reorder. To add a rule on user request:

```bash
# Append, don't rewrite. The user owns this file.
```

When a rule references a kind of thing ("always check that exported types have JSDoc"), apply it to every block that contains that kind of thing. Don't apply rules out of context — a rule about migrations doesn't apply to a CSS change.

## Things to avoid

- **Don't editorialize.** "This is a great refactor" or "this code is messy" both belong in branch checks at most, never in a block check.
- **Don't pad the checklist with checks you didn't actually run.** Five real checks beat fifteen empty ones. The trailer is a record of *work performed*; if you didn't do the work, don't write the check.
- **Don't auto-✓ everything.** A block where every check is `✓` after a real review is fine — but if you find yourself stamping `✓` on checks you didn't think about, pause and consider whether the block was the right grain.
- **Don't pull line numbers from the diff into `Source:` trailers.** The block's range is the scope. Trailers are prose citations, not line locators.
- **Don't manually set block status in frontmatter.** It's derived. Setting it creates drift.
- **Don't treat branch checks as a summary.** Summaries go in `review.md`. Branch checks are where CI status and the things only a whole-branch reviewer would notice live — not a recap.
