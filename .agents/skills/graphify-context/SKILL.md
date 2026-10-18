---
name: graphify-context
description: Maintain a compact project graph and handoff for V31 work. Use when starting, resuming, or splitting a long task.
---

# Graphify context

Read `CONTEXT_GRAPHIFY.md` first. Read `CHECKPOINT.txt` only for the current phase.

Keep the working context to five fields: scope, files, command, result, next checkpoint.
Do not load historical V2–V25 reports unless the task explicitly needs a regression comparison.

After each meaningful command, append a short evidence line to a new audit note or report.
For long work, split by subsystem and leave a checkpoint before starting the next subsystem.

## Compact handoff

Use this exact shape in the final handoff:

`SCOPE:` one subsystem
`EVIDENCE:` one command or file set
`RESULT:` pass/fail plus one sentence
`RISK:` one remaining uncertainty or `none`
`NEXT:` one executable checkpoint
