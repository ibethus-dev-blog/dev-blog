---
title: 'Automating My Blog Workflow with the Pi Coding Agent'
date: 2026-05-26T09:00:00+02:00
draft: false
cover:
  image: pi_agent.jpg
keywords: ['pi', 'coding-agent', 'automation', 'workflow', 'blog-dev', 'AI-assisted development', 'hugo', 'github-actions']
description: "Discover how the Pi coding agent automates my entire blog publishing workflow — from ticket creation to deployment — with practical examples straight from this blog's source code."
---

# Automating My Blog Workflow with the Pi Coding Agent

As a developer who maintains a technical blog, I found myself spending nearly as much time on **infrastructure and process** as on actual writing. Creating a new article meant: create a ticket, categorize it, create a branch, write the content, test it locally, commit, push, open a PR, update the ticket — rinse and repeat.

That's when I discovered **Pi**, an AI coding agent designed to work autonomously inside any project. This article walks through how I set up Pi to automate my entire blog publishing workflow, with real examples from this blog itself.

## What is Pi?

Pi is a coding agent that operates inside your project directory. It reads files, runs commands, edits code, and interacts with external services — all through a set of configurable **tools** and **skills**.

Unlike a chat assistant that gives you instructions to follow, Pi **does the work** directly: it reads your codebase, understands conventions, implements features, writes tests, commits changes, and even creates pull requests.

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                       Pi Agent (pi.dev)                          │
│                                                                  │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │   Tools    │  │   Skills     │  │  LLM Backend (API)       │ │
│  │  ────────  │  │  ──────────  │  │  ────────────────────    │ │
│  │  • read    │  │  • forge     │  │  • openai, anthropic...  │ │
│  │  • write   │  │  • secrets   │  │  • claude, gpt...        │ │
│  │  • edit    │  │  • tickets   │  │  • custom providers      │ │
│  │  • bash    │  │  • custom... │  │                          │ │
│  │  • grep    │  │              │  │                          │ │
│  │  • find    │  │              │  │                          │ │
│  └────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘ │
│       │                 │                        │              │
│       ▼                 ▼                        ▼              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Filesystem (CWD)                      │   │
│  │  reads/writes/edits files, runs commands, explores repo  │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

At its core, Pi uses a Large Language Model (LLM) — configurable to use any **OpenAI-compatible provider**, such as Claude, GPT, or local models — that has been fine-tuned to operate within a structured **agent loop**. Pi ships with no default LLM; you configure the provider and model of your choice. This means it can plan, execute, observe results, and iterate until the task is complete.

## The Skills Architecture

Skills are Markdown files that define repeatable workflows — and they're not unique to Pi. Every coding agent uses skills to understand how to operate in a project. However, Pi's real strength lies in its **extensions system**: you can write and share custom extensions using the Pi SDK, extending the agent with new tools and capabilities beyond the built-in set. Here's what I've set up for this blog:

### 1. Forge Skill (`forge-github.md`)

This skill defines how Pi interacts with GitHub as a development forge. It covers:

```bash
# Creating branches from tickets
git checkout -b "feat/42-my-feature"

# Committing with conventional commits
git commit -m "feat(scope): description

Refs: #42"

# Creating pull requests
sops exec-env .agent/secrets.enc.yaml "gh pr create \
  --title 'feat(scope): description' \
  --body '## Summary\n...\n\nCloses: #42' \
  --base main"
```

The forge skill ensures every interaction with GitHub follows consistent conventions — branch naming, commit messages, PR descriptions — all parameterized and reusable.

### 2. Secrets Skill (`secrets-sops.md`)

Security is paramount when an AI agent has access to your infrastructure. Pi uses **SOPS** (Secrets OPerationS) with **age** encryption to manage credentials:

```
.agent/
├── secrets.enc.yaml    ← Encrypted credentials (safe to commit to git)
├── secrets.yaml        ← Plaintext (in .gitignore, deleted after encryption)
├── .sops.yaml          ← SOPS configuration with age public key
└── skills/
    ├── forge-github.md
    ├── secrets-sops.md
    └── ticket-github-projects.md
```

The golden rule: all commands that need credentials are wrapped in `sops exec-env`:

```bash
# ❌ Wrong — token exposed
export GITHUB_TOKEN="ghp_xxx"
gh pr create

# ✅ Correct — token only exists during command execution
sops exec-env .agent/secrets.enc.yaml 'gh pr create --title "..." --body "..."
```

This means I can commit the encrypted secrets file to the repository without ever exposing tokens. When Pi needs to run a GitHub command, it decrypts the file into environment variables just for that one command, then wipes them.

### 3. Ticket Skill (`ticket-github-projects.md`)

This skill ties everything together by managing GitHub Issues and Projects:

- **List** assigned tickets
- **View** full ticket details with comments
- **Assign** tickets to users
- **Update** status on project boards
- **Add comments** with progress updates

## The Complete Workflow: From Ticket to Deployment

Here's how Pi handles the end-to-end lifecycle of a blog article:

### Phase 1: Task Intake

When a new idea comes in — whether it's a bug fix, a feature request, or a new article — it gets filed as a GitHub Issue. The ticket contains:

- **Title** describing the task
- **Body** with detailed requirements, ideally in the form of acceptance criteria
- **Labels** for categorization (enhancement, bug, content, etc.)
- **Assignee** for ownership

### Phase 2: Agent Invocation

I invoke Pi with the ticket number in natural language:

```
/implement ticket 21
```

Pi immediately:

1. Reads the skills documentation to understand available workflows
2. Sources credentials from the encrypted SOPS file
3. Fetches the full ticket details via `gh issue view`
4. Displays a summary for confirmation

### Phase 3: Preparation

With the ticket details confirmed, Pi:

1. **Assigns the ticket** to the appropriate user
2. **Adds an "in progress" comment** to communicate status
3. **Creates a feature branch** derived from the ticket (e.g., `content/21-pi-workflow-article`)
4. **Pulls the latest base branch** to avoid merge conflicts

### Phase 4: Implementation

This is where Pi truly shines. It:

1. **Explores the project** — reads the Hugo config, existing articles, archetypes, and theme structure
2. **Understands conventions** — frontmatter format, folder structure (bilingual: `content/en/blog/X` and `content/fr/blog/X`), image placement
3. **Implements the feature** — writes both language versions of the article, creates any needed assets
4. **Verifies the build** — runs `hugo --minify` to ensure the site compiles without errors

### Phase 5: Quality Assurance

Before committing anything, Pi runs:

- **Build verification**: `hugo --minify` checks the entire site builds
- **Convention check**: frontmatter fields, tag usage, image references
- **Content review**: both languages are complete and consistent

### Phase 6: Delivery

Once everything is verified:

1. **Commit** with a conventional commit message
2. **Push** the branch to GitHub
3. **Create a Pull Request** with a comprehensive description
4. **Update the ticket** with the PR link and testing instructions
5. **Clean up** by returning to the base branch

### Phase 7: Preview Deployment via Surge

Once the PR is open, a GitHub Actions workflow (`.github/workflows/surge-preview.yml`) automatically deploys a live preview of the site to **Surge.sh**:

```yaml
# .github/workflows/surge-preview.yml
name: Deploy Surge Preview
on:
  pull_request:
    types: [opened, reopened, edited, synchronize]

jobs:
  build-and-deploy:
    steps:
      - name: Build with Hugo
        run: hugo --gc --minify --baseURL "https://test.hot-coffee.dev/"
      - name: Publish to surge.sh
        uses: dswistowski/surge-sh-action@v1
        with:
          domain: 'test.hot-coffee.dev'
          project: 'public'
          login: \${{ secrets.SURGE_LOGIN }}
          token: \${{ secrets.SURGE_TOKEN }}
      - name: Comment deployment URL on PR
        run: gh pr comment "${{ github.event.pull_request.number }}" --body "🚀 Preview deployed to https://test.hot-coffee.dev"
```

This workflow triggers on every PR update, building the site and deploying it to a staging domain. A bot comment on the PR provides the live preview URL — perfect for reviewers to see changes without running the site locally.

## Real-World Example: This Very Article

The article you're reading right now was created using this workflow. Here's what happened behind the scenes:

### Step 1: The Ticket

Issue #21 was created with this description:

> "Le blog aurait bien besoin d'un article sur l'agent de code Pi et sur la façon dont je m'en sers pour automatiser mon workflow de travail sur mon blog, exemples à l'appui. En français et en anglais, of course."

### Step 2: Pi In Action

Pi read the ticket, analyzed the project structure, and:

- Created the branch `content/21-pi-workflow-article`
- Wrote the English article in `content/en/blog/pi-workflow/`
- Wrote the French translation in `content/fr/blog/pi-workflow/`
- Ran `hugo --minify` to verify the build
- Committed and pushed
- Created a PR and updated the ticket

All without me writing a single line of code or command.

### The Agent Loop: Behind the Scenes

Let's peek under the hood at how Pi thinks about a task. When processing this ticket, Pi's internal loop looks something like:

```
1. Read ticket #21 → "Article about my pi workflow"
2. Explore project → Hugo blog with PaperMod theme, bilingual (EN/FR)
3. Check existing articles → frontmatter pattern, cover images, structure
4. Plan → write index.md for both languages, create cover image, verify build
5. Execute → write files, run hugo --minify
6. Verify → build passed, no errors
7. Commit + Push → create PR
8. Update ticket → add comment with PR link and testing instructions
```

This isn't a static script — Pi adapts the plan based on what it finds. If the build fails, it fixes the issue and retries. If a file already exists, it updates it rather than overwriting.

## Why This Matters

### For Solo Developers

If you maintain a personal blog, open-source project, or side project, Pi eliminates the **overhead of process**. You focus on ideas and content; Pi handles the mechanics.

### For Teams

In a team setting, Pi ensures **consistent workflow execution**. Every PR follows the same conventions, every ticket is updated the same way, every branch follows the naming scheme. This reduces cognitive overhead and eliminates "process drift."

### For DevOps

Pi enforces best practices by design:
- **No hardcoded secrets** — everything goes through SOPS
- **Conventional commits** — structured, parseable history
- **Build verification** — never commit broken code
- **Comprehensive PRs** — clear descriptions, testing instructions

## Setting This Up for Your Project

Want to replicate this workflow? Here's what you need:

### 1. Install Pi

```bash
npm install -g @earendil-works/pi-coding-agent
```

### 2. Create Your Skills

Define skills as Markdown files in `.agent/skills/`. Each skill describes:
- **Name** and **description** of the capability
- **CLI commands** or **API calls** to execute it
- **Documentation** for the AI agent to understand the context

### 3. Set Up Secret Management

```bash
# Generate an age key
age-keygen -o key.txt

# Create SOPS config
cat > .agent/.sops.yaml << EOF
creation_rules:
  - age: AGE_PUBLIC_KEY
EOF

# Encrypt your secrets
sops --encrypt secrets.yaml > .agent/secrets.enc.yaml
```

### 4. Configure the Tools

Pi's tools are built-in, but you can extend them with custom tools via the **Pi SDK**. The built-in set — `read`, `write`, `edit`, `bash`, `grep`, `find`, `ls` — covers most project needs, but the SDK lets you write and share custom extensions for project-specific tasks.

### 5. Discover and Install Extensions

One of Pi's greatest strengths is its **extensions ecosystem**. You can browse and install community-contributed extensions, or write your own and share them. Extensions can add new tools, custom providers, themes for the TUI, and more — making Pi adaptable to any workflow.

### 5. Run Your First Ticket

```bash
pi "/implement ticket 1"
```

## Lessons Learned

After using Pi for several months on this blog, here's what I've found:

### What Works Well

- **Repetitive workflows**: Branching, committing, PR creation — Pi handles these flawlessly
- **Content creation**: Writing bilingual articles with consistent structure across languages
- **Build verification**: No more "it works on my machine" — Pi always verifies the actual build
- **Process enforcement**: Every PR follows the same template, every commit is conventional

### What Requires Oversight

- **Complex design decisions**: Pi follows your project's conventions, but novel architectural decisions still need human judgment
- **Security-sensitive operations**: While SOPS handles credentials well, always review what Pi is doing with access tokens
- **Nuanced content**: The AI does a good job with technical content, but human review of tone and accuracy is essential

### Future Improvements

I'm looking forward to:
- **Custom extensions**: Writing Pi extensions with the SDK for blog-specific tasks (e.g., social card generation) and sharing them with the community
- **Multi-agent workflows**: Pi agents handling different parts of the pipeline simultaneously
- **Richer project understanding**: Pi learning from past PR reviews and adapting its code style

## Conclusion

The Pi coding agent has transformed how I maintain this blog. What used to take me an hour of setup, branching, and process work for every article now happens in seconds. More importantly, the **consistency** and **reliability** of the automated workflow means I spend my energy on what matters: writing content that helps other developers.

The combination of a **skill-driven architecture**, **extensible tools via the SDK**, **SOPS-enforced security**, and **autonomous agent execution** creates a development environment where ideas flow from conception to deployment with minimal friction.

If you maintain a technical blog, open-source project, or any software project with a defined workflow, I highly recommend giving Pi a try. Set up your skills, encrypt your secrets, and let the agent handle the process while you focus on the product.

---

*This article was written using the Pi coding agent workflow it describes. The entire implementation — from ticket to published PR — was handled autonomously, including this very paragraph.*
