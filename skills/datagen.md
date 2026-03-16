# Datagen — Synthetic Data Generation Pipeline

Generate training data at scale using frontier LLMs with built-in quality gates. Designed to be resumable, de-duplicated, and quality-monitored throughout.

This skill is the entry point for any project that needs synthetic training data generated from a source dataset.

## Overview

The pipeline has three gated phases:

1. **Prototype** — Generate for 5–10 items. User reviews interactively. Iterate on prompts until satisfied.
2. **Validate** — Generate for 100 items. Judge model reviews automatically. Must pass quality thresholds.
3. **Full** — Generate for all items in batches. Judge samples periodically. Auto-stops if quality drops.

Data is stored as append-only JSONL. The pipeline tracks completed items and never re-processes them.

## Arguments

- `phase`: (optional) `prototype`, `validate`, `full`, `judge`, `stats`, `export`
  - If omitted, auto-detect the next phase based on what exists in `datagen/output/`

## Setup (first invocation)

If the project doesn't have a `datagen/` directory, create one:

### 1. `datagen/config.yaml`

Project-specific configuration. Template:

```yaml
source:
  path: <path to source data — JSONL, CSV, or any line-delimited format>
  id_field: <unique identifier field in each record>

generation:
  provider: gemini            # gemini | openai
  model: gemini-2.5-flash     # cheap + fast for generation
  queries_per_item: 100       # number of outputs per source item
  batch_size: 500             # items per batch in full generation
  rate_limit_rpm: 1500        # requests per minute

judge:
  provider: gemini
  model: gemini-2.5-pro       # stronger model for quality review
  min_score: 7.0              # 1-10, fail below this
  max_rejection_rate: 0.15    # fail if >15% of outputs rejected
  review_every_n_batches: 10  # judge frequency during full generation

output:
  dir: datagen/output
```

### 2. `datagen/generate.py`

The pipeline script with subcommands:
- `prototype [--n N]` — Phase 1: generate for N items (default 5), display samples
- `validate [--n N]` — Phase 2: generate for N items (default 100), auto-judge
- `full [--batch-size N]` — Phase 3: full dataset with periodic judge
- `judge <phase> [--sample N]` — Run judge on any phase's output
- `stats` — Show progress across all phases
- `export [--output PATH]` — Flatten to one-example-per-line training format

The script MUST:
- Track completed IDs by scanning output JSONL (no separate state DB)
- Append results one record at a time (crash-safe, resumable)
- Exclude already-generated IDs across ALL phases during full generation
- Rate-limit API calls with configurable RPM
- Retry with exponential backoff on 429/rate-limit errors
- Support both Gemini (`google-genai`) and OpenAI-compatible providers

### 3. Prompts

Embed generation and judge prompts as constants in `generate.py`. The generation prompt must:
- Accept source item fields as template variables
- Specify the exact output JSON schema
- Include diversity requirements for the generated outputs
- Provide clear rules for what goes in each field

The judge prompt must:
- Evaluate naturalness, relevance, and structural correctness
- Return an overall score (1-10), list of rejected indices, and issue summary

### 4. `datagen/requirements.txt`

```
google-genai>=1.0.0
pyyaml>=6.0
```

### 5. `datagen/.gitignore`

```
output/
```

## Phase 1: Prototype (Interactive)

**Goal**: Validate the generation prompt before spending budget.

1. Run: `python datagen/generate.py prototype --n 5`
2. Read the output file and display representative samples to the user
3. Ask focused review questions:
   - Are outputs natural and diverse?
   - Are structured fields correctly extracted?
   - Any systematic issues (e.g., repeated patterns, missing categories)?
4. If user requests changes → edit the prompt in `generate.py` and re-run
5. Delete `datagen/output/prototype.jsonl` between iterations if the prompt changed significantly (old data is stale)
6. Repeat until user explicitly approves quality

**Gate**: User must say quality is acceptable before proceeding.

## Phase 2: Validate (100 items)

**Goal**: Confirm quality holds at moderate scale with automatic review.

1. Run: `python datagen/generate.py validate --n 100`
2. Script auto-runs judge after generation completes
3. Report results to user:
   - Average judge score (must be ≥ `min_score`)
   - Rejection rate (must be ≤ `max_rejection_rate`)
   - Common issues flagged by judge
4. If judge FAILS:
   - Read `datagen/output/validate_judge.jsonl` for specific failures
   - Identify patterns (e.g., "search_text contains actor names in 20% of cases")
   - Fix the generation prompt
   - Delete `datagen/output/validate.jsonl` and `validate_judge.jsonl`
   - Re-run
5. If judge PASSES: report to user, confirm ready for full generation

**Gate**: Judge score ≥ threshold AND rejection rate ≤ threshold.

## Phase 3: Full Generation

**Goal**: Process entire dataset with quality monitoring.

1. Run: `python datagen/generate.py full`
2. Script processes in batches, printing progress
3. Every N batches, judge reviews a random sample of recent output
4. If judge score drops below threshold → script STOPS automatically
5. If stopped: review judge reports, fix issues, then re-run (resumes from where it left off)
6. Monitor anytime: `python datagen/generate.py stats`

**Gate**: Judge auto-checks. Script self-halts on quality degradation.

## Export

After generation (or at any point for partial export):

```bash
python datagen/generate.py export
```

Flattens per-item JSONL into individual training examples. De-duplicates across phases (full takes priority over validate over prototype).

## Key Design Principles

1. **Cheap generation, expensive review**: Use Flash for generation ($0.60/M output), Pro for judging ($10/M output). Judge only reviews samples, keeping costs low.
2. **Append-only, crash-safe**: Each output line is one complete item. Kill and restart anytime.
3. **No wasted budget**: Prototype catches prompt bugs on 5 items. Validate catches systematic issues on 100. Full auto-stops if quality degrades.
4. **Deterministic dedup**: Source item ID is the dedup key. Same item never processed twice.
5. **Separation of concerns**: Generation prompt, judge prompt, and config are all independently editable.

## Important

- NEVER skip the prototype phase — even if the user wants to go straight to full
- NEVER delete output files without user confirmation
- ALWAYS show samples to the user before proceeding to the next phase
- If the judge flags systematic issues, fix the prompt — don't just raise the threshold
- The generation model and judge model should be DIFFERENT (judge should be stronger)
- When adapting for a new project, the main work is writing the generation prompt and data loader — the pipeline structure stays the same
