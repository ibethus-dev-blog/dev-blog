---
name: ticket-github-projects
description: Use GitHub Issues + Projects as a ticket manager for the project
---

# Skill: GitHub Projects — Ticket Manager

**CLI:** `gh issue` + `gh projects`
**Homepage:** https://cli.github.com
**Authentication:** via `GITHUB_TOKEN` environment variable sourced from encrypted SOPS file (see `.agent/secrets.enc.yaml`).
**Token scopes required:** `repo`, `read:org`, `project`

> 🔐 **All commands require SOPS.** Run from the project root. Encrypted secrets at `.agent/secrets.enc.yaml`.
> **The exact syntax is :** sops exec-env .agent/secrets.enc.yaml "your command here"

---

## 🧭 How to Use This Skill (READ THIS FIRST)

1. **Read this entire file** before executing any operations.
2. Every `gh` command **must** be wrapped with `sops exec-env .agent/secrets.enc.yaml '...'`.
3. If any command exits with a non-zero code → **STOP**, read the error, and report it. Do NOT skip failures or simulate success.
4. Do NOT sudo, do NOT modify files outside the worktree, do NOT edit files inside `themes/` (they are submodules).
5. **Never** log or display the contents of decrypted secrets.

---

## Setup

```bash
# Pre-authenticate gh CLI (stores token in ~/.config/gh/hosts.yml)
gh auth login
# Ensure token has scopes: repo, read:org, project
gh auth status
gh auth refresh -s repo -s read:org -s project
```

## Operations

### 1. List my open tickets

Shows issues assigned to the current user that are open.

```bash
# List issues assigned to you (open only)
sops exec-env .agent/secrets.enc.yaml 'gh issue list --assignee "@me" --state open --limit 50 --json number,title,state,labels'

# Also list project items (if using a project board):
# First find your project number:
sops exec-env .agent/secrets.enc.yaml 'gh projects list --user "@me" --format=json | jq ".projects[] | {number, title}"'
# Then list items:
sops exec-env .agent/secrets.enc.yaml 'gh projects item-list PROJECT_NUMBER --user "@me" --format=json'
```

### 2. Show ticket details

Given an issue number, print full details.

```bash
# Full issue view including description, status, assignees, labels, comments
sops exec-env .agent/secrets.enc.yaml 'gh issue view ISSUE_NUMBER --comments'
```

**Example output:**
```
title: Add request rate-limiting middleware
number: 42
state: OPEN
author: ibethus
assignees: ibethus
labels: enhancement
comments: 0
body: Implement a configurable rate limiter...
```

### 3. Update ticket status

In GitHub Projects v2, status is a project field. You need the project number, the item ID, the field ID for "Status", and the option ID for the target status.

```bash
# Step 1: Find the project number and ID
#         (the "id" field is the global node ID needed for Step 4)
sops exec-env .agent/secrets.enc.yaml 'gh projects list --user "@me" --format=json | jq ".projects[] | {number, title, id}"'

# Step 2: List fields to find the Status field ID
sops exec-env .agent/secrets.enc.yaml 'gh projects field-list PROJECT_NUMBER --user "@me" --format=json | jq ".fields[] | {id, name}"'

# Step 3: Get the option ID for the target status (from the status field's options)
sops exec-env .agent/secrets.enc.yaml 'gh projects field-list PROJECT_NUMBER --user "@me" --format=json | jq ".fields[] | select(.name==\"Status\") | .options"'

# Step 4: Update the item's status field
#         ⚠️  PROJECT_ID is the project's global node ID (e.g. "PVT_..."),
#            NOT the numeric project number. Get it from Step 1 via the "id" field.
#         ⚠️  ITEM_ID is the project item ID (e.g. "PVTI_..."), NOT the issue number.
#            Get it from: gh projects item-list PROJECT_NUMBER --user "@me" --format=json
sops exec-env .agent/secrets.enc.yaml 'gh projects item-edit \
  --id ITEM_ID \
  --field-id FIELD_ID \
  --project-id PROJECT_ID \
  --single-select-option-id OPTION_ID'

# Simpler alternative: close/reopen the issue itself
sops exec-env .agent/secrets.enc.yaml 'gh issue close ISSUE_NUMBER'
sops exec-env .agent/secrets.enc.yaml 'gh issue reopen ISSUE_NUMBER'
```

### 4. Assign ticket to user

```bash
sops exec-env .agent/secrets.enc.yaml 'gh issue edit ISSUE_NUMBER --add-assignee "USERNAME"'
```

### 5. Add comment to ticket

Always use **`--body-file`** with a temp file to avoid quoting issues with newlines, backticks, and special characters.

```bash
# ✅ RECOMMENDED: Write body to a temp file, then use --body-file
cat > /tmp/comment-body.md << 'EOF'
## Testing instructions
1. Checkout branch `feat/ISSUE_NUMBER-short-description`
2. Run `npm test`
3. Verify that ...
EOF

sops exec-env .agent/secrets.enc.yaml 'gh issue comment ISSUE_NUMBER --body-file /tmp/comment-body.md'

# Clean up
rm -f /tmp/comment-body.md
```

> ⚠️ **Avoid inline `--body` with newlines or backticks.** Nested quoting inside `sops exec-env` is error-prone. The `--body-file` pattern handles all special characters safely.

### 6. List available statuses / transitions

```bash
# For issues: show all states
# (GitHub issues only have OPEN and CLOSED states;
#  richer statuses exist in project board fields)

# List all fields and their options in the project
sops exec-env .agent/secrets.enc.yaml 'gh projects field-list PROJECT_NUMBER --user "@me" --format=json | jq ".fields[] | {name: .name, options: [.options[]?.name]}"'
```

**Example output:**
```json
{"name":"Status","options":["Todo","In Progress","In Review","Done"]}
{"name":"Priority","options":["High","Medium","Low"]}
```
