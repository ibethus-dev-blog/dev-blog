---
name: forge-github
description: Use GitHub as a software forge for the project
---

# Skill: GitHub — Software Forge

**CLI:** `gh` + `git`
**Homepage:** https://cli.github.com
**Authentication:** via `GITHUB_TOKEN` environment variable sourced from encrypted SOPS file (see `.agent/secrets.enc.yaml`).
**Token scopes required:** `repo`, `read:org`, `project`

> 🔐 **All commands require SOPS.** Run from the project root. Encrypted secrets at `.agent/secrets.enc.yaml`.

---

## Setup

```bash
gh auth login  # interactive one-time setup (stores token in ~/.config/gh/hosts.yml)
gh auth setup-git  # configure git to use gh as credential helper
```

## Operations

### 1. Clone repo

```bash
gh repo clone OWNER/REPO
# Or via SSH (if SSH keys are configured):
git clone git@github.com:OWNER/REPO.git
```

### 2. Create branch from default base

```bash
# Given TICKET_ID=42 and sanitized ticket title as branch name:
TICKET_ID="42"
BRANCH="feat/${TICKET_ID}-add-rate-limiting"
BASE_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@')
git fetch origin
git stash                          # save any pending changes
git checkout "${BASE_BRANCH}"
git pull origin "${BASE_BRANCH}"
git checkout -b "${BRANCH}"
```

### 3. Create branch directly

```bash
git checkout -b "feat/42-add-rate-limiting"
```

### 4. Commit with conventional commit format

```bash
git add -A
git commit -m "feat(scope): description of the change

Detailed body explaining motivation, approach, and implementation details.

Refs: #42"
```

### 5. Push branch

```bash
git push -u origin "feat/42-add-rate-limiting"
```

### 6. Create pull request

```bash
# First check for PR template
TEMPLATE=""
if [ -f ".github/pull_request_template.md" ]; then
  TEMPLATE="--body-file .github/pull_request_template.md"
fi

sops exec-env .agent/secrets.enc.yaml "gh pr create \
  --title 'feat(scope): description of the change' \
  ${TEMPLATE} \
  --body '\$(cat <<EOF
## Summary
Brief summary of the change.

## Changes
- Change 1
- Change 2

## Testing
1. Step 1
2. Step 2
3. Verify ...

Closes: #42
EOF
)' \
  --base main"

# Or with body-file:
sops exec-env .agent/secrets.enc.yaml 'gh pr create \
  --title "feat(scope): description" \
  --body-file /path/to/pr-body.md \
  --base main'
```

### 7. Check for PR template

```bash
ls -la .github/pull_request_template.md 2>/dev/null && echo "Template found" || echo "No template"
# Also check docs/:
find . -maxdepth 3 -name "*pull*request*template*" 2>/dev/null
```

### 8. List open PRs

```bash
sops exec-env .agent/secrets.enc.yaml 'gh pr list --state open'
```

**Example output:**
```
#42  feat(middleware): add rate-limiting  feat/42-rate-limiting  OPEN
#41  fix(auth): handle token expiry        fix/41-token-expiry     OPEN
```
