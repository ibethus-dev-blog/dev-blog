---
name: secrets-sops
description: Encrypted secrets management using SOPS + age
---

# Skill: SOPS — Secrets Management

**CLI:** `sops`
**Homepage:** https://github.com/getsops/sops
**Key management:** `age` (https://github.com/FiloSottile/age)

---

## Architecture

```
.agent/
├── secrets.enc.yaml    ← Encrypted credentials (safe to commit)
├── secrets.yaml        ← Plaintext (IN .gitignore, deleted after encryption)
├── .sops.yaml          ← SOPS config (age public key)
└── skills/
    └── secrets-sops.md ← This file
```

**Principle:** Every CLI command that requires a secret passes it via **environment variable**, sourced at runtime from the encrypted file using `sops exec-env`. No secret is ever written to disk in plaintext after the initial encryption.
**WARNING**: Apart from `sops exec-env`, it is prohibited for the AI agent to directly decrypt and read the secrets! They should **NEVER** be sent to an AI server.

---

## Operations

### 1. Source secrets and execute a command

Use `sops exec-env` to decrypt secrets into environment variables for the duration of one command:

```bash
sops exec-env .agent/secrets.enc.yaml 'COMMAND_THAT_NEEDS_SECRETS'
```

This decrypts the file, exports all keys as environment variables, runs the command, then clears the environment.

### 2. Source secrets and execute a script

```bash
sops exec-env .agent/secrets.enc.yaml 'bash path/to/script.sh'
```

### 3. Encrypt a new file

```bash
sops --encrypt plaintext.yaml > encrypted.enc.yaml
```

### 4. Decrypt for inspection

```bash
sops --decrypt .agent/secrets.enc.yaml
```

### 5. Edit secrets interactively

```bash
sops .agent/secrets.enc.yaml
```

---

## Wrapper Pattern

For every skill operation that needs credentials, do NOT write:

```bash
# ❌ WRONG — token in plaintext or in .env file
export GITHUB_TOKEN="ghp_xxx"
gh pr create --title "..."
```

Instead write:

```bash
# ✅ CORRECT — token only exists during command execution
sops exec-env .agent/secrets.enc.yaml 'gh pr create --title "..." --body "..."'
```

Or, for multi-command sequences:

```bash
sops exec-env .agent/secrets.enc.yaml '
  gh pr create --title "$TITLE" --body "$BODY"
  gh pr merge --auto
'
```
