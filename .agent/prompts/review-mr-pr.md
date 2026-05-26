---
name: review merge/pull request prompt
description: workflow describing how to review a merge/pull request, given its ID or URL
argument-hint: "<mr-pr-id-or-url>"
---

## 🔍 Code Review Workflow — MR/PR: $1

You are an expert software engineer AI agent. Using the skills and tooling set up in `.agent/`, perform a thorough code review of the given merge/pull request. Post your review directly on the MR/PR and add a comment to the associated ticket with a summary.

Use your @forge, @secrets and @ticket skills to process the user request.

### Pre-flight Checklist
1. Source encrypted credentials: verify `.agent/secrets.enc.yaml` exists and is decryptable.
2. Verify you are in the project root.
3. Confirm git status is clean.

### Step 1 — Fetch MR/PR Details
Use the forge skill (`.agent/skills/forge-github.md`) to:
- Fetch the full PR: title, description, source branch, target branch, author, labels.
- List all changed files and their diff stats.

```bash
# GitHub PR view with full details
sops exec-env .agent/secrets.enc.yaml 'gh pr view $1 --json title,body,headRefName,baseRefName,author,files,labels,state'

# Show the diff
sops exec-env .agent/secrets.enc.yaml 'gh pr diff $1'
```

### Step 2 — Fetch Associated Ticket
- Extract the ticket ID from the PR title, description, or branch name (look for patterns like `#17`, `Closes #17`).
- If a ticket reference is found, fetch the full ticket details using the ticket skill (`.agent/skills/ticket-github-projects.md`).
- Compare the ticket's acceptance criteria with the code changes.

```bash
sops exec-env .agent/secrets.enc.yaml 'gh issue view TICKET_ID --comments'
```

### Step 3 — Checkout the Branch Locally
- Stash any pending changes, then fetch and checkout the PR source branch.

```bash
BRANCH_NAME="SOURCE_BRANCH"
git stash
git fetch origin "${BRANCH_NAME}"
git checkout -b "review-${BRANCH_NAME}" "origin/${BRANCH_NAME}"
```

### Step 4 — Verify the Build Succeeds
Before writing the review, verify that the PR branch builds successfully.

```bash
# Run Hugo build — this MUST succeed before proceeding
hugo --minify 2>&1
```

If `hugo --minify` fails, note the build error as a **blocking issue** in your review. Do not skip or ignore build failures.

### Step 5 — Perform Code Review
Review every changed file with a critical eye. Check for:

1. **Correctness** — Does the code implement what the ticket requires? Are edge cases handled?
2. **Security** — Any injection vulnerabilities? Secrets hardcoded? Unsafe deserialization? Missing input validation? Broken access control?
3. **Performance** — Unnecessary allocations? N+1 queries? Missing caching? Inefficient loops?
4. **Testing** — Are tests present and sufficient? Do they cover edge cases and error paths? Do they actually test the behavior or just mock everything?
5. **Maintainability** — Is the code readable? Well-named? Following the project's conventions? Free of commented-out code and TODOs without tickets?
6. **Architecture** — Does it fit the existing architecture? No duplicated logic? Proper separation of concerns?
7. **Dependencies** — New libraries added? Are they maintained, lightweight, and necessary?
8. **Configuration** — New env vars documented? Sensible defaults? Feature flags?

Run static analysis if available:
```bash
# Run the project's linter
npm run lint 2>&1 || echo "No lint script"
```

### Step 6 — Write the Review
Structure the review into three sections:

**✅ What looks good** — Highlight well-written code, good tests, smart choices.

**⚠️ Suggestions** — Non-blocking improvements, alternative approaches, style nits.

**🔴 Blocking issues** — Bugs, security problems, missing tests, **build failures**, architectural concerns that must be addressed before merging.

For each issue found, reference the specific file and line number.

### Step 7 — Post Review on the PR
Use the forge skill to submit the review on the PR.

For an overall review decision:
- **Approve** if there are no blocking issues.
- **Request Changes** if there are blocking issues.
- **Comment only** if you only have suggestions.


Before posting, read the pre-formatted usage footer from `.pi-usage-footer.txt` and append it to the review body.

```bash
# Build the review body in a temp file
cat > /tmp/pi-review.md << 'BODY'
REVIEW_CONTENT

BODY

# Append the pre-formatted usage footer
cat .pi-usage-footer.txt >> /tmp/pi-review.md

# Submit the review
sops exec-env .agent/secrets.enc.yaml gh pr review "$1" --body-file /tmp/pi-review.md --COMMENT|--APPROVE|--REQUEST-CHANGES
```

### Step 8 — Post Review Summary on the Ticket
Use the ticket manager skill to add a comment to the associated ticket with:
- A link to the PR.
- A summary of the review (overall verdict: approved / changes requested / commented).
- Number of blocking issues, suggestions, and positive highlights.
- Next steps (e.g., "Please address the 2 blocking issues above, then re-request review").
- Token usage summary — read the pre-formatted footer from `.pi-usage-footer.txt`.

```bash
# Write the ticket summary to a temp file
cat > /tmp/pi-ticket-comment.md << 'BODY'
## Code Review Summary

**PR:** LINK_TO_PR
**Verdict:** APPROVED|CHANGES_REQUESTED|COMMENT_ONLY

### Blocking Issues: N
- [ ] Issue 1 (file.ts:42): ...
- [ ] Issue 2 (module.ts:18): ...

### Suggestions: M
- Suggestion 1: ...

### Highlights
- Well-structured implementation
- Good patterns
- ...

**Next steps:** Please address the blocking issues and re-request review.

BODY

# Append the pre-formatted usage footer
cat .pi-usage-footer.txt >> /tmp/pi-ticket-comment.md

# Post the comment
sops exec-env .agent/secrets.enc.yaml gh issue comment TICKET_ID --body-file /tmp/pi-ticket-comment.md
```
### Step 9 — Cleanup
- Return to the base branch and delete the review branch.

```bash
BASE_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@')
git checkout "${BASE_BRANCH}"
git branch -D "review-${BRANCH_NAME}"
```

### Step 10 — Summary
Output a summary of the review:
- PR ID and link
- Associated ticket ID and link
- Overall verdict
- Count of blocking issues, suggestions, and highlights
- Where the review was posted (PR comments + ticket comment)

---

**Constraints:**
- Never expose secrets in output or logs.
- Always use `sops exec-env` for any command requiring credentials.
- Do not modify files outside the review worktree.
- Be constructive and respectful in all review comments.
- If no ticket is referenced, skip steps 2 and 7 (only post to the PR).
- **Build verification:** Run `hugo --minify` before submitting the review. If the build fails, log it as a blocking issue.
