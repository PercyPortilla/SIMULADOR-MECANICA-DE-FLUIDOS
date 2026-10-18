# V31 context graph

This file is the compact handoff for long-running Codex work.

## Current phase

- Phase: V31 closure
- Renderer: Babylon.js
- Next checkpoint: run one focused audit, record evidence, then continue.

## Rules

- Read this file first; do not reload historical reports unless the current phase requires them.
- Keep each audit focused on one subsystem and one command family.
- End every long command with a short result in `CHECKPOINT.txt`.
- If a command runs longer than five minutes without output, stop it and split the audit.
- Never run the complete audit suite when a targeted test can answer the question.

## Handoff format

1. Scope
2. Files inspected
3. Command or test
4. Result
5. Remaining risk
6. Next checkpoint
