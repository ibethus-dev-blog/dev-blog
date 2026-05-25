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

### Step 2 — Update Ticket to "In Progress" & Assign
- Assign the ticket to yourself.
- Add a comment marking it as in-progress.

```bash
sops exec-env .agent/secrets.enc.yaml 'gh issue edit $1 --add-assignee "$GITHUB_USERNAME"'
sops exec-env .agent/secrets.enc.yaml 'gh issue comment $1 --body "🚧 **Status: In Progress** — implementation started."'
```

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

### Step 6 — Push

```bash
git push -u origin "${BRANCH_NAME}"
```

### Step 7 — Create Pull Request
- Check if a PR template exists (`.github/pull_request_template.md`).
- If a template exists: use it as the base, append ticket reference.
- If no template exists: write a comprehensive but concise description covering:
  - **Summary** (what was done)
  - **Changes** (key files and modifications)
  - **Testing** (exact commands to verify the feature)
- Reference the ticket ID.
- Use the forge skill (`.agent/skills/forge-github.md`) with SOPS wrapping.

```bash
sops exec-env .agent/secrets.enc.yaml 'gh pr create \
  --title "{type}(scope): description" \
  --body "## Summary
...

Closes: #$1" \
  --base main'
```

### Step 8 — Update Ticket with PR Link and Testing Instructions
- Add a comment with:
  - Link to the PR.
  - **Testing instructions** (copy the testing section from the PR description).
  - What environment/configuration is needed.

```bash
sops exec-env .agent/secrets.enc.yaml 'gh issue comment $1 --body "## ✅ Implemented — Ready for Review

**Branch:** \`${BRANCH_NAME}\`
**PR:** LINK_TO_PR

### How to test
{instructions}"'
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
