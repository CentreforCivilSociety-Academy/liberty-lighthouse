# Liberty Lighthouse — Claude Skill

This is a Claude Skill that lets Claude navigate the [Liberty Lighthouse](https://liberty-lighthouse.vercel.app) corpus — a public-education site on Indian classical-liberal policy published by the Centre for Civil Society.

## Install

### Claude Code

```bash
claude plugin install <this-repo-url>
```

Or copy the folder to `~/.claude/skills/liberty-lighthouse/`.

### claude.ai (Pro/Team/Max/Enterprise)

1. Open Claude → **Settings** → **Capabilities** → **Skills** → **Customize**.
2. Upload this folder (or paste `SKILL.md` content into the custom-skill creator).
3. Activate.

## What it does

When you ask Claude something covered by the Liberty Lighthouse corpus — Indian education vouchers, school choice, MSP, APMC reform, contract farming, RTE Act, the Centre for Civil Society's positions — Claude fetches the relevant markdown pages from the live site and answers with citations to canonical URLs.

This is a Karpathy-style "exploration over retrieval" pattern: no pre-bundled knowledge files, no embeddings, no RAG. Claude reads the corpus the same way a human researcher would — start at the index, descend into topics, follow links.

## Maintenance

The corpus updates on every Vercel deploy. The skill picks up new content the next time it fetches a URL — no skill republish required.

If the URL conventions change (very unlikely; documented in [/AGENTS.md](https://liberty-lighthouse.vercel.app/AGENTS.md)), update `SKILL.md` accordingly.

## Source

The skill content (`SKILL.md`) is a copy of the file maintained at:
<https://github.com/centre-for-civil-society/liberty-lighthouse/tree/main/docs/distribution/claude-skill>

To distribute, push this folder as the contents of a new public GitHub repo (e.g. `liberty-lighthouse-claude-skill`).
