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
