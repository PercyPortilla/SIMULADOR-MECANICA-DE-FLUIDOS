# V31 audit matrix

Use the smallest row that answers the question. Do not run the complete suite during investigation.

| Question | Focused evidence |
| --- | --- |
| Equipment appearance or fallback | `tests/babylon/equipmentVisual.test.js`, `tests/babylon/equipmentContractsParity.test.js` |
| Roads, berms, cuts, fills, tracks | `tests/babylon/primaryHaulRoad.test.js`, `tests/babylon/roadVisualDetails.test.js`, `tests/babylon/serviceRoads.test.js`, `tests/babylon/receptionEarthwork.test.js` |
| Terrain and mine surface | `tests/babylon/mineTerrain.test.js`, `tests/babylon/minePropsOperationalSurface.test.js` |
| Inspection and labels | `tests/babylon/equipmentInspection.test.js`, `tests/babylon/labelContracts.test.js`, `tests/babylon/cameraPresets.test.js` |
| Piping and process route | `tests/babylon/pipingSystem.test.js`, `tests/babylon/pipeRacks.test.js`, `tests/babylon/industrialInfrastructure.test.js` |
| Babylon/Three migration | `tests/babylon/migrationContract.test.js`, then `rg -n "three|THREE|three\.js" src tests package.json` |
| Release readiness | targeted checks first, then `npm test`, then `npm run build`, then `git diff --check` |

## Evidence record

Every audit must record:

- exact command;
- duration;
- pass/fail count;
- files changed;
- remaining risk;
- next checkpoint.

Historical reports are references only. Do not treat their full contents as active context.
