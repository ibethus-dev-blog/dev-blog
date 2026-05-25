# Pi `/implement` Pipeline

Comment `/implement` on a GitHub issue and a pipeline spins up that runs the pi coding agent to implement the ticket — it reads the codebase, makes changes, pushes a branch, and opens a PR.

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
git add .github/workflows/pi-implement.yml .github/scripts/pi-implement.mjs
git commit -m "ci: add pi /implement pipeline"
git push
```

## Usage

Comment `/implement` on any open issue. The bot will:

1. Assign the ticket and mark it in-progress
2. Create a branch `feat/<number>-<slug>`
3. Implement the feature
4. Push and open a PR
5. Comment on the issue with the PR link

If something fails, the workflow comments on the issue with a link to the failed run.

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
