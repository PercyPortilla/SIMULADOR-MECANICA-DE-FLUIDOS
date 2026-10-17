# PULPA LAB 3D — V6 Scale, Open Pit & Industrial Plant Final Report

## Scope

This checkpoint applies the authorized sequence from the master rule through Phases 0–26 and stops at the Final integrated validation phase. No post-final feature phase was started.

The governing spatial contract is **1 Three.js unit = 1 metre**. The site was replanned so the open pit, haulage system and process plant no longer share the previous compact footprint.

## Phase completion summary

| Phase | Scope | Final state |
|---|---|---|
| Master Rule | Preserve modular Vite/Three.js architecture, physical/visual separation and one lifecycle | Applied |
| 0 | Dimensional audit | Applied as central scale contract/tests |
| 1 | Global scale normalization | Applied |
| 2 | Site expansion | Applied: 820 m × 520 m |
| 3 | Plant masterplan | Applied: separated process modules and clearances |
| 4 | Auxiliary buildings / domestic-looking house | Applied: replaced/repositioned as industrial control/MCC building |
| 5 | Open-pit mine | Applied: stepped pit, benches, working floor and ore face |
| 6 | Main haul road | Applied: 18.5 m main road, graded ramp, shoulders/crown/berms |
| 7 | Mining shovel | Applied: articulated pit loading cycle |
| 8 | Haul truck cycle | Applied: load → haul → ROM dump → return |
| 9 | ROM pad / embankment | Applied |
| 10 | Hopper + feeder | Applied and animated |
| 11 | Primary crusher | Applied with mechanically legible internals/motion |
| 12 | Conveyors | Applied with visible belt/mineral flow |
| 13 | Stockpile / reclaim | Applied with reclaim hopper/feeder |
| 14 | Wheel loader | Applied with articulated reclaim cycle |
| 15 | Grinding | Applied: industrial-scale mill assembly |
| 16 | Sump + slurry pump + cyclones | Applied |
| 17 | Leaching | Applied: spaced reactors with internals/slurry |
| 18 | CIP / elution / EW / smelting | Applied and redistributed within recovery zone |
| 19 | Piping + internal slurry | Applied; physical and visual diameters remain separate |
| 20 | Transparent / Cutaway / Interior | Applied; Cutaway uses real clipping planes |
| 21 | Materials / rendering pass | Applied |
| 22 | Nine camera presets | Reframed for enlarged site; Inspection range expanded |
| 23 | Integrated animation | Applied through central animation lifecycle |
| 24 | Collision/clearance audit | Applied statically to layout/routes and corrected key conflicts |
| 25 | Performance pass | Applied: reuse/instancing/no per-frame geometry creation in new systems |
| 26 | Final scale audit | Applied statically |
| Final | Integrated validation only | Reached; no later phase started |

## Final dimensional contracts

- World scale: **1 unit = 1 m**.
- Site: **820 × 520 m**.
- Reference haul truck: **10.0 × 5.25 × 5.0 m**.
- Reference wheel loader: **12.0 × 3.7 × 4.25 m**.
- Reference mining shovel body envelope: **9.9 × 8.0 × 8.1 m**.
- Open pit plan envelope: approximately **276 × 208 m**.
- Pit floor target elevation: **−30 m**.
- Bench height: **10 m**.
- Main haul road: **18.5 m**.
- Main road width / truck width ratio: **3.524**.
- Maximum grade measured at ROAD-01 control segments: **8.217%**.
- Minimum plant-zone gap: **9 m**; master minimum target: **8 m**.
- Inspection controls: **2.5–520 m**.
- `scene.fog = null`.
- `recoveryModel = null` remains unchanged.

## Layout and operating logic

The scene now separates the mine and process plant. The material path is represented as:

**open pit → mining shovel → haul truck → primary haul road → ROM pad → hopper/feeder → primary crusher → conveyors → stockpile → wheel loader → reclaim hopper/feeder → grinding → sump/slurry pump → cyclones → leaching → CIP → elution → EW → smelting**.

The previous domestic-looking white building is no longer treated as a house in the operating area. It is represented as an industrial control/MCC-type building and is positioned outside the principal heavy-vehicle process corridor.

## Roads and civil works

The old compact-road assumption was replaced for the principal mining route. ROAD-01 is a heavy-haul route sized independently from plant service roads. Terrain height along its control points is graded continuously, and road geometry uses a crowned cross section rather than a flat strip. ROM civil works include a larger engineered embankment, maneuvering apron and retaining/safety elements.

## Mobile equipment and animation

- Trucks use mining-scale proportions and an operating state cycle.
- The main haul path connects pit loading and ROM unloading without teleporting.
- Dump-body motion is hinged from the rear and includes reusable ore-dump visual particles.
- The mining shovel has undercarriage/body/boom/stick/bucket articulation and a loading cycle.
- The wheel loader has articulated steering, boom/bucket movement, visible bucket load and stockpile-to-reclaim cycle.
- Mobile equipment samples the centralized terrain-height function for ground contact.
- New animation systems remain under the central lifecycle; no independent animation loop was added.

## Mineral-processing equipment

The front end, mill/classification and recovery equipment were rescaled/rebuilt to read as separate industrial modules instead of a compact low-detail cluster. Leach reactors use larger industrial proportions and wider spacing. Recovery equipment is distributed across the recovery zone rather than compressed into one small pad.

## Piping and slurry visibility

Hydraulic and rendering dimensions remain separate:

- `physicalDiameterM` is retained for physical/hydraulic meaning.
- `visualDiameterM` uses a readability floor; it is not used for physical calculations.
- Current minimum rendered pipe diameter: **0.40 m**.
- Slurry pipes can display a continuous internal fluid representation through straight sections and bends.

Pipe 1 no longer uses the requested hydraulic length to physically move reactor R-02. The hydraulic length is retained as metadata while the visual route connects the fixed equipment endpoints.

## Inspection modes

A centralized equipment inspection controller supports:

- Normal
- Transparent
- Cutaway
- Interior

Cutaway mode uses renderer clipping planes; it is not only an opacity change. Internal slurry/process components are tagged separately from external shells.

## Camera contract

The nine conceptual presets remain:

1. General
2. Top
3. Oblique
4. Reception / loading
5. Crushing / stockpile
6. Grinding / classification
7. Leaching
8. Recovery
9. Inspection

Inspection remains the orbit/pan/zoom mode and its maximum distance was expanded to 520 m to accommodate the enlarged site.

## Static validation evidence

### JavaScript syntax

- Files checked under `src` and `tests`: **77**.
- `node --check` failures: **0**.

### Relative imports

- Relative imports inspected: **174**.
- Missing relative imports: **0**.

### JSON

- `package.json`: valid JSON.
- `package-lock.json`: valid JSON.

### Package integrity

Neither dependency manifest was changed:

- `package.json` SHA-256: `d8c70b9af27e5d4d4ff0cabad42d57382a468f549f489bdfcf9c62402c3cb3bf`
- `package-lock.json` SHA-256: `388ad48b259bcc317bffd619a5afa657b757e90f814c33b338afb8bd6c5eaa99`

These hashes match the source checkpoint used for this upgrade.

### Runtime commands

`npm test` and `npm run build` were invoked at Final validation. They could not execute because the environment does not currently contain the required `vitest` and `vite` binaries. A dependency-install attempt in this environment did not yield a usable dependency tree. The project manifests were not altered to force installation.

Results:

- `npm test`: **⛔ NOT VALIDATED — `vitest: not found`**
- `npm run build`: **⛔ NOT VALIDATED — `vite: not found`**
- Real browser/WebGL visual validation: **⛔ NOT VALIDATED in this container**

No success is claimed for those three runtime checks.

## Final validation matrix

| System | Status | Evidence |
|---|---|---|
| World scale contract | ✅ | `WORLD_UNITS_PER_METER = 1` |
| Expanded site | ✅ | 820 × 520 m contract |
| Open-pit geometry | ✅ | Pit design + centralized terrain-height model |
| Mining fleet scale | ✅ | Central dimensional references and rebuilt equipment |
| Main haul-road width | ✅ | 18.5 m; ratio 3.524× truck width |
| Main ramp grade | ✅ | 8.217% max at route control segments |
| Process-module separation | ✅ | No zone overlaps; 9 m minimum gap |
| Domestic-looking building issue | ✅ | Replaced/reframed as industrial control/MCC facility |
| Pit → ROM truck route | ✅ | Route/state logic implemented |
| Shovel loading animation | ✅ | Central mobile-equipment update logic |
| Truck loading/haul/dump/return | ✅ | State cycle implemented |
| Loader reclaim cycle | ✅ | Articulated stockpile-to-hopper cycle |
| Feeder/crusher animation | ✅ | Central industrial animation controller |
| Conveyor belt/mineral animation | ✅ | Texture/material movement + reusable mineral instances |
| Grinding/classification layout | ✅ | Mill/sump/pump/cyclone module rebuilt |
| Leaching scale/internals | ✅ | Larger spaced reactors with slurry/internals |
| Recovery visual layout | ✅ | CIP/elution/EW/smelting expanded in Z8 |
| Physical vs visual pipe diameter | ✅ | Separate values retained |
| Slurry visibility in pipes | ✅ | Internal fluid geometry available in inspection modes |
| Cutaway architecture | ✅ | Renderer clipping enabled + clipping planes |
| Nine camera presets | ✅ | Preserved/reframed |
| `scene.fog === null` | ✅ | Explicit scene setting |
| `recoveryModel === null` | ✅ | Preserved |
| JS syntax/import integrity | ✅ | 77 JS files / 174 relative imports checked |
| Automated test suite | ⛔ | `vitest` unavailable in environment |
| Production build | ⛔ | `vite` unavailable in environment |
| Real browser visual/FPS pass | ⛔ | Browser runtime not available for this validation |

## Stop condition

The requested **Final Phase has been reached**. This checkpoint intentionally stops here. No post-final feature or enhancement phase has been started.
