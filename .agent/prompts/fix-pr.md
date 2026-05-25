---
name: fix pull request prompt
description: workflow describing how to fix an issue on a pull request, given its ID and an optional fix description
argument-hint: "<pr-id> [fix-description]"
---

## 🔧 Fix PR Workflow — PR: $1 | Fix: $2

You are an expert software engineer AI agent. Using the skills and tooling set up in `.agent/`, fix the issue described in the trigger comment on the given pull request. After fixing, push the changes and comment back on the PR.

Use your @forge, @secrets and @ticket skills to process the user request.

### Pre-flight Checklist
1. Source encrypted credentials: verify `.agent/secrets.enc.yaml` exists and is decryptable.
2. Verify you are in the project root.
3. Confirm git status is clean.

### Step 1 — Understand the Fix Request
Read the environment variables to understand what triggered this fix:

- **COMMENT_BODY** (env): The full `/fix` comment. It starts with `/fix` followed by:
  - An explicit description of what to fix (e.g., "/fix the button color is wrong")
  - A reference to other comments or reviews in the PR (e.g., "/fix as suggested in the review", "/fix the issue @user mentioned")
- **COMMENT_AUTHOR** (env): The user who wrote the comment.
- **COMMENT_ID** (env): The GitHub comment ID.

If the fix instruction references other comments or reviews, you will need to fetch them in the next step.

### Step 2 — Fetch PR Details
Use the forge skill (`.agent/skills/forge-github.md`) to fetch the full PR context:

```bash
# PR details
sops exec-env .agent/secrets.enc.yaml 'gh pr view $1 --json title,body,headRefName,baseRefName,author,files,labels,state,reviews,comments'

# PR diff — understand the codebase state
sops exec-env .agent/secrets.enc.yaml 'gh pr diff $1'
```

Also read these environment variables for context:
- **PR_NUMBER**: The PR number.
- **PR_TITLE**: The PR title.
- **PR_BODY**: The PR description body.

### Step 3 — Fetch PR Comments & Reviews (if needed)
If the fix instruction references other comments or reviews, fetch them:

```bash
# All comments on the PR
sops exec-env .agent/secrets.enc.yaml 'gh pr view $1 --comments --json comments'

# All reviews on the PR
sops exec-env .agent/secrets.enc.yaml 'gh pr view $1 --json reviews'
```

Extract relevant context:
- If the user said "fix as suggested in the review", look at the review comments for change requests.
- If the user said "fix the issue @user mentioned", find @user's comments and extract the issue.
- If the user gave a direct description, use that directly.

### Step 4 — Checkout the PR Branch Locally
- Stash any pending changes.
- Fetch and checkout the PR source branch.

```bash
PR_NUMBER="$1"
SOURCE_BRANCH=$(sops exec-env .agent/secrets.enc.yaml 'gh pr view $1 --json headRefName --jq .headRefName')
git stash
git fetch origin "${SOURCE_BRANCH}"
git checkout -b "fix-${SOURCE_BRANCH}" "origin/${SOURCE_BRANCH}"
```

### Step 5 — Implement the Fix
- Understand the codebase conventions (language, framework, testing, linting).
- Read the relevant files to understand the context.
- Apply the **minimal fix** needed — do not refactor or change unrelated code.
- If the fix involves code changes, write or update tests to cover the fix.
- Ensure the project still builds and passes linting:

```bash
# Run Hugo build to verify
hugo --minify 2>&1 || echo "Build check done"

# Run linter
npm run lint 2>&1 || echo "No lint script"

# Run tests
npm test 2>&1 || echo "No test script"
```

### Step 6 — Commit and Push
- Configure git identity.
- Commit with a conventional commit message referencing the PR and the comment.

```bash
git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git add -A
git commit -m "fix(pr): address fix request on PR #$1

Request: $2

Triggered by @${COMMENT_AUTHOR} in comment #${COMMENT_ID}.

Refs: #$1"
git push origin "HEAD:${SOURCE_BRANCH}"
```

### Step 7 — Comment Back on the PR
Post a comment summarizing what was fixed:

```bash
sops exec-env .agent/secrets.enc.yaml 'gh pr comment $1 --body "## ✅ Fix Applied

**Requested by:** @${COMMENT_AUTHOR}
**What was fixed:** $2

### Changes
- Summary of what was changed and why.
- Key files modified.

**Next steps:** The fix has been pushed to the branch. The CI pipeline should re-trigger automatically."'
```

### Step 8 — Cleanup
- Return to the base branch.

```bash
BASE_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@')
git checkout "${BASE_BRANCH}"
git branch -D "fix-${SOURCE_BRANCH}" 2>/dev/null || true
```

### Step 9 — Summary
Output a summary of everything done:
- PR ID and link.
- What was fixed.
- Key files modified.
- Link to the fix comment.
- Whether the PR needs re-review.

---

**Constraints:**
- Never expose secrets in output or logs.
- Always use `sops exec-env` for any command requiring credentials.
- Only fix what was requested — do not widen the scope.
- If the fix request is unclear or ambiguous, ask for clarification on the PR instead of making assumptions.
- If no files were changed (e.g., the request was unclear), still comment on the PR explaining why.
- Do not modify files outside the PR branch's worktree.
