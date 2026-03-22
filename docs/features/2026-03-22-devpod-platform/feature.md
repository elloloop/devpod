---
title: "DevPod Platform — Local CI, PR Review & Feature Docs"
slug: "devpod-platform"
date: "2026-03-22"
status: "shipped"
prs:
  - number: 1
    title: "Add local GitHub Actions runner, web dashboard, and feature documentation platform"
    repo: "elloloop/devpod"
    status: "merged"
video: "./demo.webm"
screenshots:
  - "./screenshots/01-dashboard.png"
  - "./screenshots/02-features.png"
  - "./screenshots/03-commits.png"
  - "./screenshots/04-diff-view.png"
  - "./screenshots/05-runs.png"
---

## Summary
A complete local development platform: GitHub Actions-compatible workflow runner with REST API, Phabricator-style PR review dashboard, and automated feature documentation with video demos.

## What Changed
- Local actions runner (6.9k lines) — parses .github/workflows/, executes locally with sandboxed git worktrees, secrets management, matrix strategy, marketplace actions
- Web dashboard (Next.js + shadcn) — PR review with real git diffs, feature timeline, workflow run monitoring with SSE
- Video capture action — Playwright-based recording for web, adb/xcrun for mobile
- 3 new skills: feature-lead orchestrator, feature-documentation, bugfix-evidence
- 305 unit + integration tests, 4 CI workflows
