# Codex workflow for V31

This project uses short, evidence-producing checkpoints to prevent context growth and inactivity cancellation.

## Before starting

1. Read `CONTEXT_GRAPHIFY.md`.
2. Read only the current checkpoint and the files named by the task.
3. Choose one subsystem and one validation command.

## During work

- Keep one active objective at a time.
- Prefer a targeted test file over `npm test`.
- Prefer `npm run build` as its own checkpoint.
- If a command is silent for 5 minutes, stop it and split the work.
- Emit a progress record after each command: scope, evidence, result, risk, next.
- Do not re-read all historical reports after compaction.

## Audit budget

The full suite is a release gate, not an exploration command. Use it once after targeted checks pass.

Targeted examples:

```text
npx vitest run tests/equipmentVisual.test.ts --maxWorkers=1 --testTimeout=15000
npx vitest run tests/primaryHaulRoad.test.ts tests/roadVisualDetails.test.ts --maxWorkers=1 --testTimeout=15000
npm run build
```

Replace test names with the smallest relevant set. Record duration and pass count in the checkpoint.

## Long-running work

Split work into resumable phases:

1. inspect and map;
2. make one focused change;
3. run one targeted check;
4. save evidence;
5. continue or hand off.

Never leave a single objective waiting on a silent full audit. A checkpoint is a valid progress change even when the code is unchanged.
