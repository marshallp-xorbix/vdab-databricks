# Pull Request Workflows

**Last Updated:** 17 June 2026  

Rules live in [`AGENTS.md`](../../AGENTS.md). Read this file when the user asks you to **review a pull request / branch** or to **draft a PR description**. It covers two related workflows:

- [PR Review](#pr-review-workflow) — produce copy-paste-ready review comments for the Azure DevOps PR UI.
- [PR Description](#pr-description-workflow) — produce a concise Markdown description to paste into Azure DevOps.

Both can pull context directly from Azure DevOps via the `az` CLI (`azure-devops` extension). When the CLI is unavailable or unauthenticated, **ask the user to paste the missing input — never invent it.**

---

## Recognizing the request

Treat any of these as a trigger to read and follow this file, even when the prompt does not spell out the steps:

- "Perform/do a PR review", "review this branch/PR", "review my changes against `develop`".
- "Write/draft/build a PR description", "summarize this branch for a PR".

When triggered, **do not assume the prompt already contains everything you need.** Gather the inputs below. If one is missing, pull it from Azure DevOps; if that fails, ask for it *before* producing output. Do not start reviewing or writing against partial context.

---

## Gathering inputs (both workflows)

| Input | How to obtain |
| --- | --- |
| **Source branch + base** | Use what the user named (e.g. branch `X` against `develop`). If the source isn't given, default to the current branch (`git rev-parse --abbrev-ref HEAD`); if the base isn't given, default to the team's integration branch (usually `develop`). Confirm both when there's any doubt rather than guessing. |
| **Code diff** | `git fetch <remote> <base>` then `git diff <base>...<source>` (three-dot — compares against the merge base). Review the diff, not the whole repo. |
| **Linked work items / tasks** | Try Azure DevOps (below); fall back to asking the user to paste. Verify the change against each item's acceptance criteria. |
| **PR description** (review only) | Try Azure DevOps (below); fall back to asking. |

### Pulling from Azure DevOps

Xorbix work lives in the **`https://dev.azure.com/Xorbix/`** organization (constant). Do **not** hardcode the project — derive it per repo from the git remote: Azure DevOps remotes look like `https://Xorbix@dev.azure.com/Xorbix/<Project>/_git/<Repo>` (or `git@ssh.dev.azure.com:v3/Xorbix/<Project>/<Repo>`), so `git remote get-url origin` yields both the project and the repo.

Authenticate and set defaults once, then the query commands stay clean:

```bash
az login
az devops configure --defaults organization=https://dev.azure.com/Xorbix/ project=<Project>
```

(Or pass `--organization https://dev.azure.com/Xorbix/ --project <Project>` on each call.) If any command errors — not logged in, no PR exists yet, wrong project — **stop trying and ask the user to paste the content** rather than guessing.

```bash
# Find the PR for the branch (add --repository <Repo> if the project has several)
az repos pr list --source-branch <source> --target-branch <base> \
  --query "[].{id:pullRequestId,title:title}" -o table

# PR description (review workflow)
az repos pr show --id <prId> --query "description" -o tsv

# Work items linked to the PR, then each item's details
az repos pr work-item list --id <prId> --query "[].id" -o tsv
az boards work-item show --id <workItemId> \
  --query "{id:id, title:fields.'System.Title', desc:fields.'System.Description', ac:fields.'Microsoft.VSTS.Common.AcceptanceCriteria'}"
```

---

## PR Review Workflow

### What to review against

Review the **diff** for conformance to the rules in [`AGENTS.md`](../../AGENTS.md) and the relevant pattern docs ([backend](backend-patterns.md) / [frontend](frontend-patterns.md)). Prioritize in this order:

1. Correctness and security bugs.
2. Architecture / layering violations (controller → repository, service injecting `DbContext`, Contracts depending on Infrastructure).
3. Standards conformance (naming, `Result<T>`/typed errors, async, validation placement).
4. Maintainability (duplication, abstraction, tests, docs).

Confirm the change actually satisfies the linked work items' acceptance criteria.

### Severity tiers

Sort every finding into one tier. Be honest — most comments are Minor or Nit, and a clean PR may have zero Blockers.

| Tier | Meaning |
| --- | --- |
| **Blocker** | Must fix before merge. Bugs, security holes, data loss, layering violations, broken build/tests, unmet acceptance criteria. |
| **Major** | Should fix before merge. Missing error handling, missing tests for branching logic, wrong abstraction, API-contract gaps. |
| **Minor** | Worth fixing, not merge-blocking. Naming, small duplication, missing XML/JSDoc, narrow refactors. |
| **Nit** | Optional / subjective. Style preferences, micro-cleanups. |

### Low-signal items — mention once, do not push

Some signals are worth a one-line note but are **expected to be acknowledged and ignored**, not actioned. Mention each **at most once**, as a **Nit**, with **no fix code**, and never escalate it above Nit:

- **Cognitive complexity / size targets** ([Size & Complexity Targets](../../AGENTS.md)) — flag a method/file over target only if a refactor is clearly in scope; otherwise note briefly and move on.
- **Formatting handled by tooling** (Prettier, `dotnet format`) — do not hand-review whitespace, import order, or quote style.
- **`var` vs explicit type** and similar style points already consistent with the surrounding file.

When several of these land in one file, collapse them into a single **"Non-blocking signals"** line rather than one comment each.

### Output format

Organize **by file, then by severity** (Blocker → Major → Minor → Nit). Each finding is a **self-contained Markdown comment** the user pastes into a single Azure DevOps PR comment — so it must read on its own, without relying on the surrounding headers.

Give each finding a short, stable **ID**: a 2–4 letter file abbreviation + number (e.g. `USVC-1` for `UserService.cs`), unique across the whole review, so the user can point to any single item ("clarify `USVC-2`").

Keep each comment concise: one-line problem statement, one sentence or paragraph of *why* (cite the rule when relevant), and a fix code block when one helps. Use the file's language for fences.

````markdown
## `src/Services/UserService.cs`

### Blocker
**[USVC-1] (Blocker)** `GetUser` swallows the repository failure and returns `null`, so the controller maps it to `200 OK` with an empty body instead of `404`.

Return the typed error so `HandleFluentResult` produces the right status:

```csharp
if (user is null)
    return Result.Fail(new NotFoundError($"User {id} not found"));
```

### Minor
**[USVC-2] (Minor)** `userRepo` → `userRepository`; avoid abbreviations (AGENTS naming rule).

### Non-blocking signals
**[USVC-3] (Nit)** Method is ~60 LOC / cognitive complexity slightly over target — noted only; refactor is out of scope for this PR.
````

Close with a short **Summary**: counts per tier and a one-line merge recommendation (e.g. "2 Blockers, 1 Major — request changes").

---

## PR Description Workflow

Produce a **Markdown** PR description for the user to paste into Azure DevOps. Hard rules:

- **Under 4000 characters total.** Report the final character count so the user can confirm.
- **Descriptive but concise.** Lead with the *what* and *why*; bullet the rest. No filler, no restating the entire diff.
- Derive content from the **diff** and the **linked work items** gathered above.

### Suggested structure

```markdown
## Summary
1–3 sentences: what this PR does and why.

## Work Items
- AB#1234 — <title>

## Changes
- <area/layer>: <what changed> — one bullet per meaningful change, grouped by layer or feature.

## Testing
- <how it was validated: tests added, manual steps>

## Notes / Risks
- <migrations, config, breaking changes, follow-ups>
```

Drop any section that does not apply rather than padding it (omit **Notes / Risks** when there are none). If the draft exceeds 4000 characters, tighten the **Changes** bullets first, then fold **Notes** into **Summary** — **never silently truncate**; tell the user what you trimmed.
