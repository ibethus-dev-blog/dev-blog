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


Also read ISSUE_NUMBER, ISSUE_TITLE, and ISSUE_BODY from the environment if available (they are pre-populated in CI).

### Step 2 — Update Ticket to "In Progress" & Assign
- Assign the ticket to yourself.
- Add a comment marking it as in-progress.

In CI, use the bot identity (`github-actions[bot]`); locally, use your username.

### Step 3 — Create Branch
- Derive a branch name from the ticket: `feat/$1-{slugified-title}` or `fix/$1-{slugified-title}` depending on ticket type.
- Detect the base branch (`main`).
- Stash any pending changes, checkout base, pull latest, then create the feature branch.

### Step 4 — Implement the Feature
- Read the project structure, understand the codebase conventions (language, framework, testing, linting).
- Implement the feature as described in the ticket's acceptance criteria.
- Write **comprehensive tests** (unit + integration). Target > 80% code coverage for new code.
- Ensure **code quality**:
  - Run the project's linter and formatter.
  - Run the type checker if applicable (TypeScript, mypy, etc.).
  - Ensure all existing tests still pass.
  - Follow existing code patterns and architecture.
- **Verify the build passes** before committing any changes:

```bash
# Run Hugo build — this MUST succeed before committing
hugo --minify 2>&1
```

If `hugo --minify` fails, fix the build error before proceeding. Never commit code that breaks the build.

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
- Use the forge skill (`.agent/skills/forge-github.md`).
- 
### Step 8 — Update Ticket with PR Link and Testing Instructions
- Read the pre-formatted usage footer from `.pi-usage-footer.txt` (written by the CI script).
- Add a comment with:
  - Link to the PR.
  - **Testing instructions** (copy the testing section from the PR description).
  - Token usage summary (model, input/output tokens, cost).
  - What environment/configuration is needed.

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
- **Build verification:** Run `hugo --minify` before committing any changes. Never commit code that breaks the build.
