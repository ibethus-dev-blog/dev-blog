# Pi AI Agent Pipelines

A single consolidated workflow (`.github/workflows/pi.yml`) handles all AI agent commands via GitHub issue/PR comments.

## Commands

### `/implement` — Implement from issue

Comment `/implement` on any open **issue**. The bot will:

1. Assign the ticket and mark it in-progress
2. Create a branch `feat/<number>-<slug>`
3. Implement the feature
4. Push and open a PR
5. Comment on the issue with the PR link

### `/fix` — Fix from PR comment

Comment `/fix [optional instruction]` on a **pull request**. The bot will:

1. Read the PR diff and context
2. Apply the requested fix or follow the optional instruction
3. Push changes directly to the PR branch
4. Comment on the PR with a summary

### `/review` — Review a PR

Comment `/review [optional focus area]` on a **pull request**. The bot will:

1. Read the PR diff and context
2. Perform a code review (optionally focused on a specific area)
3. Comment on the PR with the review findings

## Setup

### 1. GitHub secrets & variables

```bash
# Required
gh secret set PI_API_KEY     --body "sk-ant-..."       # LLM provider API key
gh secret set SOPS_AGE_KEY   --body "AGE-SECRET-KEY-..." # SOPS decryption key
gh variable set PI_PROVIDER  --body "anthropic"          # or: openai, groq, deepseek, google

# Optional — pi uses its defaults if unset
gh variable set PI_MODEL     --body "claude-sonnet-4-20250514"
gh variable set PI_THINKING  --body "low"                # off | minimal | low | medium | high | xhigh

# Required for surge.sh preview deploys (see surge-preview.yml)
gh secret set SURGE_LOGIN --body "your-surge-email@example.com"
gh secret set SURGE_TOKEN --body "your-surge-token"          # get via: surge token
```

### 2. SOPS secrets file

Make sure `.agent/secrets.enc.yaml` exists and is encrypted with the same age key whose private half you stored as `SOPS_AGE_KEY`. The file must contain a `GITHUB_TOKEN` entry.

```bash
# Verify it decrypts locally
sops exec-env .agent/secrets.enc.yaml 'gh auth status'
```

### 3. Push the workflow

```bash
git add .github/workflows/pi.yml .github/scripts/pi-*.mjs
git commit -m "ci: add consolidated pi AI agent pipeline"
git push
```

## Scripts

| Script | Command | Trigger | Prompt |
|--------|---------|---------|--------|
| `pi-implement.mjs` | `/implement` | Issue comment | `/implement-ticket <number>` |
| `pi-fix.mjs` | `/fix [instruction]` | PR comment | `/fix-pr <number> [instruction]` |
| `pi-review-pr.mjs` | `/review [focus]` | PR comment | `/review-mr-pr <number> [focus]` |

## Surge.sh Preview Deploys

PRs created by the pi pipeline (or any PR) are automatically deployed to **Surge.sh** at `test.hot-coffee.dev` via a separate workflow (`.github/workflows/surge-preview.yml`). It triggers on PR `opened`, `synchronize`, and `reopened`.

The build steps are **identical** to the production Hugo Pages workflow — same Hugo version, flags, and dependencies.

To set up Surge:

```bash
npm install -g surge
surge token

gh secret set SURGE_LOGIN --body "your@email.com"
gh secret set SURGE_TOKEN --body "your-token-here"
```
