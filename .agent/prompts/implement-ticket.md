---
name: implement ticket prompt
description: workflow describing how to implement a ticket, given its number
argument-hint: "<ticket-id>"
---

## 🚀 Complete Feature Workflow — Ticket: $1

You are an expert software engineer AI agent. Using the skills and tooling set up in `.agent/`, execute the complete workflow for ticket $1.

Use your @forge, @secrets and @ticket skills to process the user request.

If you encounter any issue with your skills, update them with what you learned on the way.

### Pre-flight Checklist
1. Source encrypted credentials: verify `.agent/secrets.enc.yaml` exists and is decryptable.
2. Verify you are in the project root.
3. Confirm git status is clean.

### Step 1 — Fetch Ticket Details
Use the ticket manager skill (`.agent/skills/ticket-github-projects.md`) to:
- Fetch the full issue: title, description, acceptance criteria, status, assignee.
- Display the ticket summary for confirmation.

```bash
sops exec-env .agent/secrets.enc.yaml 'gh issue view $1 --comments'
```

Also read ISSUE_NUMBER, ISSUE_TITLE, and ISSUE_BODY from the environment if available (they are pre-populated in CI).

### Step 2 — Update Ticket to "In Progress" & Assign
- Assign the ticket to yourself.
- Add a comment marking it as in-progress.

```bash
sops exec-env .agent/secrets.enc.yaml 'gh issue edit $1 --add-assignee "@me"'
sops exec-env .agent/secrets.enc.yaml 'gh issue comment $1 --body "🚧 **Status: In Progress** — implementation started."'
```

In CI, use the bot identity (`github-actions[bot]`); locally, use your username.

### Step 3 — Create Branch
- Derive a branch name from the ticket: `feat/$1-{slugified-title}` or `fix/$1-{slugified-title}` depending on ticket type.
- Detect the base branch (`main`).
- Stash any pending changes, checkout base, pull latest, then create the feature branch.

```bash
TICKET_ID="$1"
TICKET_TYPE="feat"  # or "fix", "chore", "docs", "refactor" — infer from ticket
BRANCH_NAME="${TICKET_TYPE}/${TICKET_ID}-short-description"
BASE_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")
git fetch origin
git stash
git checkout "${BASE_BRANCH}"
git pull origin "${BASE_BRANCH}"
git checkout -b "${BRANCH_NAME}"
```

### Step 4 — Implement the Feature
- Read the project structure, understand the codebase conventions (language, framework, testing, linting).
- Implement the feature as described in the ticket's acceptance criteria.
- Write **comprehensive tests** (unit + integration). Target > 80% code coverage for new code.
- Ensure **code quality**:
  - Run the project's linter and formatter.
  - Run the type checker if applicable (TypeScript, mypy, etc.).
  - Ensure all existing tests still pass.
  - Follow existing code patterns and architecture.

### Step 5 — Commit with Conventional Commits
- Stage all changes.
- Commit with a [Conventional Commit](https://www.conventionalcommits.org/) message:
  ```
  {type}({scope}): {description}
  
  {body with details, motivation, approach}
  
  Refs: #{TICKET_ID}
  ```

```bash
git add -A
git commit -m "{type}(scope): {description}

{detailed body}

Refs: #$1"
```

In CI, configure the git user first:
```bash
git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
```

### Step 6 — Push
- **Important:** Push using the PAT from the secrets file (`sops exec-env`) so that the push triggers other CI workflows. Do NOT use a plain `git push origin` — it would use the auto-generated GITHUB_TOKEN which doesn't trigger workflows.

```bash
# Use the sops-decrypted PAT for push so other CI workflows are triggered
sops exec-env .agent/secrets.enc.yaml bash -c 'git push -u "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" "${BRANCH_NAME}"'
```

### Step 7 — Create Pull Request
- Check if a PR template exists (`.github/pull_request_template.md`).
- If a template exists: use it as the base, append ticket reference.
- If no template exists: write a comprehensive but concise description covering:
  - **Summary** (what was done)
  - **Changes** (key files and modifications)
  - **Testing** (exact commands to verify the feature)
- Reference the ticket ID.
- Use the forge skill (`.agent/skills/forge-github.md`).

```bash
sops exec-env .agent/secrets.enc.yaml 'gh pr create \
  --title "{type}(scope): description" \
  --body "## Summary
...

Closes: #$1" \
  --base main'
```

### Step 8 — Update Ticket with PR Link and Testing Instructions
- Read the token usage from `.pi-usage.json` (written by the CI script).
- Add a comment with:
  - Link to the PR.
  - **Testing instructions** (copy the testing section from the PR description).
  - Token usage summary (model, input/output tokens, cost).
  - What environment/configuration is needed.

```bash
USAGE=$(cat .pi-usage.json 2>/dev/null || echo "{}")
USAGE_MODEL=$(echo "$USAGE" | jq -r '.model // "unknown"')
USAGE_TOKENS=$(echo "$USAGE" | jq -r '"\(.inputTokens // 0) in / \(.outputTokens // 0) out"')
USAGE_COST=$(echo "$USAGE" | jq -r '"$\(.cost // 0)"')
sops exec-env .agent/secrets.enc.yaml 'gh issue comment $1 --body "## ✅ Implemented — Ready for Review

**Branch:** \`${BRANCH_NAME}\`
**PR:** LINK_TO_PR

### How to test
{instructions}

---
*🤖 Generated by pi — ${USAGE_MODEL}  |  ${USAGE_TOKENS}  |  ${USAGE_COST}*"'
```

### Step 9 — Cleanup
- Return to the base branch.

```bash
git checkout "${BASE_BRANCH}"
```

### Step 10 — Summary
Output a summary of everything that was done:
- Ticket ID and link
- Branch name
- Commits
- PR link
- Testing instructions

---

**Constraints:**
- Never expose secrets in output or logs.
- Always use `sops exec-env` for any command requiring credentials.
- If any step fails, stop and report the error with context before proceeding.
- Do not modify files outside the worktree.
- Respect existing `.gitignore`, linter configs, and project conventions.
