---
name: ci auto-fix prompt
description: workflow describing how to automatically fix issues reported by CI tools (SonarQube, linters, tests, security scans) on a given ticket or MR/PR
argument-hint: "<ticket-id-or-mr-pr-url> <ci-report-file-path>"
---

## 🔧 CI Auto-Fix Workflow — Ticket: $1 | CI Report: $2

You are an expert software engineer AI agent. Using the skills and tooling set up in `.agent/`, read the CI feedback report for a given ticket or merge/pull request, analyze the issues, implement fixes on a new branch, push the changes, and update the ticket with what was fixed.

Use your @forge, @secrets and @ticket skills to process the user request.

### Pre-flight Checklist
1. Source encrypted credentials: verify `.agent/secrets.enc.yaml` exists and is decryptable.
2. Verify you are in the project root.
3. Confirm git status is clean.
4. Confirm the CI report file exists and is readable ($2).

### Step 1 — Parse the CI Report
Read and parse the CI report file passed as the second argument. The report may come from:
- **SonarQube** — quality gate failures, code smells, bugs, vulnerabilities, coverage gaps.
- **ESLint / Pylint / Rubocop** — lint violations with file paths and line numbers.
- **Test runner output** — failing tests, flaky tests, missing coverage.
- **Trivy / Snyk / Dependabot** — vulnerable dependencies, outdated packages.
- **Checkov / tfsec** — infrastructure-as-code security issues.

Extract from the report:
- **Category** (security, bug, code smell, coverage, dependency, style)
- **Severity** (blocker, critical, major, minor, info)
- **File path and line number**
- **Rule ID and description**
- **Remediation guidance** if provided by the tool

```bash
# Parse a JSON report
cat "$2" | jq '.issues[] | {severity: .severity, component: .component, line: .line, message: .message, rule: .rule}'

# Plain text report — read as-is
cat "$2"
```

### Step 2 — Fetch Associated Ticket & PR Context
- If $1 is a ticket ID (e.g., `17`), fetch the ticket details.
- If $1 is a PR URL, fetch its details and extract the associated ticket.
- Understand the original feature/fix scope so you don't accidentally widen it.

```bash
# Fetch ticket
sops exec-env .agent/secrets.enc.yaml 'gh issue view $1 --comments'

# Fetch PR
sops exec-env .agent/secrets.enc.yaml 'gh pr view $1'
```

### Step 3 — Create a Fix Branch
- Derive a branch name from the ticket: `fix/$1-ci-fixes`.
- Stash any pending changes, then checkout the source branch of the PR, or create from base branch if working from a ticket.

```bash
TICKET_ID="$1"
BRANCH_NAME="fix/${TICKET_ID}-ci-fixes"
BASE_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")

# If there's an existing PR branch, use it as base
SOURCE_BRANCH="feat/${TICKET_ID}-feature-name"
git stash
git fetch origin "${SOURCE_BRANCH}"
git checkout -b "${BRANCH_NAME}" "origin/${SOURCE_BRANCH}"
```

### Step 4 — Prioritize and Categorize Issues
Group the CI issues and decide which to fix:

| Priority | Action | Examples |
|----------|--------|----------|
| **P0 — Fix now** | Must be addressed before merge. | Security vulnerabilities, broken tests, type errors. |
| **P1 — Fix if clear** | Fix if the solution is obvious and safe. | Code smells with clear remediation, uncovered critical paths. |
| **P2 — Note only** | Add as suggestion on the ticket but don't modify code. | Style nitpicks, minor duplication, cognitive complexity on legacy code. |
| **Skip** | False positives or intentional choices. | Known false positives, intentional choices, test-only code. |

Document the decision for each issue.

### Step 5 — Implement the Fixes
For each P0 and P1 issue:
- Read the surrounding code to understand context.
- Apply the minimal, correct fix.
- If the CI tool provides remediation guidance, follow it.
- Do **not** refactor or change unrelated code.
- After each fix, run the relevant check locally to confirm resolution:

```bash
# Lint the fixed file
npx eslint --fix path/to/file.ts

# Run Hugo build to verify
hugo --minify
```

### Step 6 — Commit the Fixes
Use a conventional commit message that references both the ticket and the CI tool:

```bash
git add -A
git commit -m "fix(scope): address CI feedback from TOOL_NAME

Fixes issues reported by the CI pipeline:
- ISSUE-1: Description (file.ts:42)
- ISSUE-2: Description (module.ts:18)

All fixes are minimal and scoped to the reported issues.

Refs: #$1"
```

### Step 7 — Push the Fix Branch

```bash
git push -u origin "${BRANCH_NAME}"
```

### Step 8 — Create a Fix PR (if applicable)
If the original work is already in a PR, push to the same branch instead. If starting from a ticket, create a new PR.

```bash
sops exec-env .agent/secrets.enc.yaml 'gh pr create \
  --title "fix(scope): address CI feedback — #$1" \
  --body "## Summary
This PR addresses issues reported by the CI pipeline (TOOL_NAME) for #$1.

## Issues Fixed
| Issue | Severity | File | Description |
|-------|----------|------|-------------|
| ISSUE-1 | Blocker | file.ts:42 | Description |
| ISSUE-2 | Critical | module.ts:18 | Description |

## Testing
1. Run CI pipeline locally: \`npm run ci\`
2. Verify all previously failing checks now pass
3. Confirm no regressions

Refs: #$1" \
  --base main'
```

### Step 9 — Update the Ticket with Fix Summary
Add a comment to the ticket explaining:
- Which CI tool reported issues.
- How many issues were found, how many were fixed (P0/P1), how many were noted (P2), and how many were skipped.
- A table summarizing the fixes.
- A link to the fix branch or PR.

```bash
sops exec-env .agent/secrets.enc.yaml 'gh issue comment $1 --body "## CI Auto-Fix Report — TOOL_NAME

**Branch:** \`FIX_BRANCH\`
**PR:** LINK_TO_PR

| Status | Count |
|--------|-------|
| P0 — Fixed (blockers) | N |
| P1 — Fixed (clear issues) | M |
| P2 — Noted (minor/suggestions) | K |
| Skipped (false positives) | L |
| **Total issues** | TOTAL |

### P0 Fixes (Blockers)
- [x] ISSUE-1 (file.ts:42): Description
- [x] ISSUE-2 (module.ts:18): Description

### P1 Fixes (Clear Issues)
- [x] ISSUE-3 (utils.ts:10): Description

### P2 Notes (Not Fixed)
- ISSUE-4 (legacy.ts:200): Noted for future refactor (out of scope).

### Skipped
- ISSUE-5 (test.ts:5): False positive.

**Next steps:** Please review the fix branch and merge if approved. The CI pipeline should be re-run to confirm resolution."'
```

### Step 10 — Cleanup
- Return to the base branch and delete the fix branch.

```bash
BASE_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@')
git checkout "${BASE_BRANCH}"
git branch -D "${BRANCH_NAME}"
```

### Step 11 — Summary
Output a summary of everything done:
- CI tool name and report file
- Associated ticket and/or PR
- Total issues found vs. fixed vs. noted vs. skipped
- Fix branch name and link
- Next steps for the developer

---

**Constraints:**
- Never expose secrets in output or logs.
- Always use `sops exec-env` for any command requiring credentials.
- Only fix issues related to the scoped ticket/PR. Do not touch unrelated files.
- Minimal fixes only — no opportunistic refactoring.
- If unsure about any fix (e.g., ambiguous business logic), add it as a P2 note instead of changing code.
- If the CI report is empty or unreadable, stop and ask for a valid report.
