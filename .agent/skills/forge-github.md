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
> **The exact syntax is :** sops exec-env .agent/secrets.enc.yaml "your command here"

---

## 🧭 How to Use This Skill (READ THIS FIRST)

1. **Read this entire file** before executing any operations.
2. Every `gh` command **must** be wrapped with `sops exec-env .agent/secrets.enc.yaml '...'`.
3. If any command exits with a non-zero code → **STOP**, read the error, and report it. Do NOT simulate success.
4. Do NOT edit files inside `themes/` — they are git submodules.
5. For `git commit`, **build verification must succeed first** (e.g., `hugo --minify` for Hugo projects). Never commit if the build fails.
6. **Never** log or display the contents of decrypted secrets.

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
# Name format: {type}/{TICKET_ID}-{slugified-title}
# Do NOT repeat "ticket" in the branch name — e.g., "feat/42-add-rate-limiting" is correct,
# "feat/42-ticket-42" is redundant and confusing.
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

> ⚠️ **Before pushing**, verify the remote URL matches the expected repository:
> ```bash
> git remote -v
> ```
> If the remote URL differs from the project's canonical URL (e.g., `ibethus:dev-blog` vs `ibethus-dev-blog:dev-blog`), the push may succeed but subsequent PR creation will fail with `No commits between ...`.
> In that case, update the remote:
> ```bash
> git remote set-url origin git@github.com:OWNER/REPO.git
> ```

### 6. Create pull request

Always use **`--body-file`** with a temp file. This is the most robust approach — it avoids all quoting issues with special characters, backticks, and newlines.

```bash
# ✅ RECOMMENDED: Write body to a temp file, then use --body-file
cat > /tmp/pr-body.md << 'EOF'
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

sops exec-env .agent/secrets.enc.yaml 'gh pr create \
  --title "feat(scope): description of the change" \
  --body-file /tmp/pr-body.md \
  --base main'

# Clean up the temp file
rm -f /tmp/pr-body.md
```

> ⚠️ **Never inline the body inside the `sops exec-env` command string.** Nested quoting is error-prone and causes hard-to-debug failures (e.g., `pull request title must not be blank`).
>
> If you must inline (e.g., dynamic content), write the body to a temp file first, then reference it with `--body-file`. This is the only pattern that handles newlines, single quotes, double quotes, and backticks safely.

```bash
# Read body from a pre-existing file:
sops exec-env .agent/secrets.enc.yaml 'gh pr create \
  --title "feat(scope): description" \
  --body-file .github/PULL_REQUEST_BODY.md \
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
