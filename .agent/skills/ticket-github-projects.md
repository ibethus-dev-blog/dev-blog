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
# Step 1: Find the project number
sops exec-env .agent/secrets.enc.yaml 'gh projects list --user "@me" --format=json | jq ".projects[] | {number, title}"'

# Step 2: List fields to find the Status field ID
sops exec-env .agent/secrets.enc.yaml 'gh projects field-list PROJECT_NUMBER --user "@me" --format=json | jq ".fields[] | {id, name}"'

# Step 3: Get the option ID for the target status (from the status field's options)
sops exec-env .agent/secrets.enc.yaml 'gh projects field-list PROJECT_NUMBER --user "@me" --format=json | jq ".fields[] | select(.name==\"Status\") | .options"'

# Step 4: Update the item's status field
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

```bash
sops exec-env .agent/secrets.enc.yaml 'gh issue comment ISSUE_NUMBER --body "## Testing instructions
1. Checkout branch \`feat/ISSUE_NUMBER-short-description\`
2. Run \`npm test\`
3. Verify that ..."'
```

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
