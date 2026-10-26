import './styles.css';
import { getInitialState, getState, resetState, updateState } from './state/simulationState.js';
import { calculateSimulationResults, getResults, subscribe as subscribeResults } from './controller/simulationController.js';
import { CAMERA_PRESET_LABELS, CAMERA_PRESET_ORDER } from './ui/cameraMetadata.js';
import { PARAMETER_SECTIONS } from './ui/parameterSchema.js';
import { renderResultsPanel } from './ui/resultsPanel.js';
import { renderCurvesAndProbes } from './ui/curvesPanel.js';
import { renderBalanceAndEnergy } from './ui/balancePanel.js';
import { renderMemoryPanel } from './ui/memoryPanel.js';
import { renderSensitivityPanel } from './ui/sensitivityPanel.js';
import { loadExampleSimulation } from './ui/exampleScenario.js';
import {
  DEFAULT_THEME,
  applyTheme,
  loadTheme,
  resetTheme,
  saveTheme,
} from './ui/theme.js';
import {
  DEFAULT_SCENE_PALETTE,
  loadScenePalette,
  paletteHexToNumbers,
  resetScenePalette,
  saveScenePalette,
} from './ui/scenePalette.js';
import {
  compareScenarios,
  deleteNamedScenario,
  exportScenarioCsv,
  exportScenarioJson,
  listScenarios,
  loadNamedScenario,
  saveNamedScenario,
} from './ui/scenarios.js';
import { PALETTE_PRESETS, getPalettePreset } from './ui/palettes.js';
import {
  PRESENTATION_STOP_IDS,
  getInspectionComponentHotspots,
  getInspectionGuideEntry,
  getInspectionRelatedResult,
  getInspectionStage,
} from './ui/inspectionGuide.js';
import { ACADEMIC_CASES, getAcademicCase, loadAcademicCase } from './ui/academicCases.js';
import { compareAcademicCases } from './ui/academicComparison.js';
import {
  ACADEMIC_LAB_EXPERIMENTS,
  evaluateAcademicHypotheses,
  getAcademicExperiment,
} from './ui/academicLab.js';
import { buildAcademicLabReportHtml } from './ui/academicLabReport.js';
import { RELEASE_INFO } from './releaseInfo.js';

const app = document.querySelector('#app');
let activeTheme = applyTheme(loadTheme());
let activeScenePalette = loadScenePalette();
let environmentHandle = null;
let unsubscribeProcessMetrics = null;
let activeWorkspaceTab = 'circuit';
let startPresentationTour = null;
let lastAcademicLabEvaluation = null;
let activeComparisonScenarioId = null;

loadExampleSimulation(updateState);

const sections = PARAMETER_SECTIONS;
const PARAMETER_SECTION_ORDER = Object.freeze(['slurry', 'rheology', 'transport', 'losses', 'energy', 'leaching', 'recovery', 'process']);

function readPath(state, path) {
  return path.reduce((value, key) => value[key], state);
}

function makeField(field, state) {
  if (field.models && !field.models.includes(state.rheology.model)) return null;
  const label = document.createElement('label');
  label.className = 'parameter-field';
  label.htmlFor = `field-${field.path.join('-')}`;

  const name = document.createElement('span');
  name.className = 'parameter-field-label';
  const [labelText, ...unitParts] = String(field.label).split(' · ');
  const labelName = document.createElement('span');
  labelName.className = 'parameter-field-name';
  labelName.textContent = labelText;
  name.append(labelName);
  if (unitParts.length) {
    const unit = document.createElement('span');
    unit.className = 'parameter-field-unit';
    unit.textContent = unitParts.join(' · ');
    name.append(unit);
  }
  if (field.help) name.title = field.help;
  label.append(name);
  if (field.help) {
    const help = document.createElement('small');
    help.className = 'field-help';
    help.textContent = field.help;
    label.append(help);
  }

  const input = field.type === 'select'
    ? document.createElement('select')
    : document.createElement('input');
  input.id = label.htmlFor;
  input.name = field.path.join('.');
  input.dataset.path = field.path.join('.');
  if (field.type === 'select') {
    field.options.forEach(([value, text]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      input.append(option);
    });
  } else {
    input.type = field.type;
    if (field.type === 'number') {
      input.inputMode = 'decimal';
      input.min = String(field.min);
      if (field.max !== undefined) input.max = String(field.max);
      input.step = String(field.step);
    }
  }
  input.disabled = Boolean(field.disabled || field.disabledWhen?.(state));
  const value = readPath(state, field.path);
  if (field.type === 'checkbox') input.checked = Boolean(value);
  else input.value = field.display ? field.display(value) : value;
  input.addEventListener('change', () => {
    const nextValue = field.type === 'checkbox' ? input.checked : field.type === 'number' ? Number(input.value) : input.value;
    updateNestedState(field.path, field.parse ? field.parse(nextValue) : nextValue);
  });
  label.append(input);
  return label;
}

function updateNestedState(path, value) {
  const patch = {};
  let cursor = patch;
  path.forEach((key, index) => {
    if (index === path.length - 1) cursor[key] = value;
    else { cursor[key] = {}; cursor = cursor[key]; }
  });
  try {
    updateState(patch);
    renderError('');
    if (path[0] === 'rheology' && path[1] === 'model') renderParameterSections();
  } catch (error) {
    renderError(error.message);
  }
}

function makeSection(section, state) {
  const details = document.createElement('details');
  const processSection = ['leaching', 'recovery', 'process'].includes(section.id);
  details.className = `parameter-section ${processSection ? 'parameter-section-process' : 'parameter-section-hydraulic'}`;
  details.dataset.sectionId = section.id;
  details.open = section.id === 'slurry'
    || section.id === 'transport'
    || (section.id === 'rheology' && Boolean(state.rheology.model));
  const summary = document.createElement('summary');
  summary.textContent = section.title;
  details.append(summary);
  const content = document.createElement('div');
  content.className = 'section-content';
  if (section.fields.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-section';
    empty.textContent = section.emptyMessage ?? 'Sin parámetros definidos en el modelo actual.';
    content.append(empty);
  } else {
    section.fields.filter((field) => !field.advanced).forEach((field) => {
      const node = makeField(field, state);
      if (node) content.append(node);
    });
    const advancedFields = section.fields.filter((field) => field.advanced);
    if (advancedFields.length) {
      const advanced = document.createElement('details');
      advanced.className = 'parameter-advanced';
      advanced.innerHTML = '<summary>Parámetros avanzados</summary>';
      const advancedContent = document.createElement('div');
      advancedContent.className = 'advanced-content';
      advancedFields.forEach((field) => {
        const node = makeField(field, state);
        if (node) advancedContent.append(node);
      });
      advanced.append(advancedContent);
      content.append(advanced);
    }
  }
  details.append(content);
  return details;
}

function renderError(message) {
  const node = document.querySelector('#validation-message');
  if (node) node.textContent = message;
}

function renderParameterSections() {
  const sectionHost = document.querySelector('#sections');
  if (!sectionHost) return;
  const state = getState();
  sectionHost.replaceChildren();
  [...sections]
    .sort((left, right) => PARAMETER_SECTION_ORDER.indexOf(left.id) - PARAMETER_SECTION_ORDER.indexOf(right.id))
    .forEach((section) => sectionHost.append(makeSection(section, state)));
  sectionHost.append(createSegmentEditor(state));
  sectionHost.append(createPumpCurveEditor(state));
}

function createSegmentEditor(state) {
  const details = document.createElement('details');
  details.className = 'parameter-section circuit-segments';
  const summary = document.createElement('summary');
  summary.textContent = '07 / Circuito por tramos';
  details.append(summary);
  const body = document.createElement('div');
  body.className = 'section-content segment-editor-body';
  const segments = state.transport.segments ?? [];
  if (!segments.length) {
    const note = document.createElement('p');
    note.className = 'empty-section';
    note.textContent = 'Pipe 1 opera como circuito legacy de un tramo. Puedes convertirlo a segmentos editables.';
    body.append(note);
    const createButton = document.createElement('button');
    createButton.type = 'button';
    createButton.className = 'segment-action';
    createButton.textContent = 'Crear circuito desde Pipe 1';
    createButton.addEventListener('click', () => {
      const pipe = getState().transport.pipe1;
      updateState({ transport: { segments: [{ id: 'S1', innerDiameterM: pipe.innerDiameterM, lengthM: pipe.lengthM, roughnessM: pipe.roughnessM, material: pipe.material, elevationChangeM: pipe.elevationChangeM, minorLossCoefficient: pipe.minorLossCoefficient, accessories: structuredClone(pipe.accessories) }] } });
      renderParameterSections();
    });
    body.append(createButton);
  } else {
    segments.forEach((segment, index) => {
      const card = document.createElement('div');
      card.className = 'segment-card';
      const fieldDefinitions = [
        ['id', 'ID', 'text', 0.01], ['innerDiameterM', 'D · m', 'number', 0.001], ['lengthM', 'L · m', 'number', 0.1],
        ['elevationChangeM', 'Δz · m', 'number', 0.1], ['roughnessM', 'ε · m', 'number', 0.000001], ['minorLossCoefficient', 'K adicional', 'number', 0.01],
      ];
      const grid = document.createElement('div');
      grid.className = 'segment-grid';
      fieldDefinitions.forEach(([key, labelText, type, step]) => {
        const label = document.createElement('label');
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = type;
        if (type === 'number') input.step = String(step);
        input.value = segment[key] ?? '';
        input.addEventListener('change', () => {
          const next = structuredClone(getState().transport.segments);
          next[index][key] = type === 'number' ? Number(input.value) : input.value;
          updateState({ transport: { segments: next } });
        });
        label.append(input);
        grid.append(label);
      });
      card.append(grid);
      const accessoryDetails = document.createElement('details');
      accessoryDetails.className = 'segment-accessories';
      accessoryDetails.innerHTML = '<summary>Accesorios del tramo</summary>';
      const accessoryGrid = document.createElement('div');
      accessoryGrid.className = 'segment-grid';
      [['valvesCount','Válvulas'],['elbowsCount','Codos 90°'],['teesCount','Tes'],['reducersCount','Reducciones']].forEach(([key,labelText]) => {
        const label = document.createElement('label'); label.textContent = labelText;
        const input = document.createElement('input'); input.type='number'; input.min='0'; input.step='1'; input.value=segment.accessories?.[key] ?? 0;
        input.addEventListener('change',()=>{ const next=structuredClone(getState().transport.segments); next[index].accessories={...next[index].accessories,[key]:Number(input.value)}; updateState({transport:{segments:next}}); });
        label.append(input); accessoryGrid.append(label);
      });
      accessoryDetails.append(accessoryGrid); card.append(accessoryDetails);
      const remove = document.createElement('button'); remove.type='button'; remove.className='segment-remove'; remove.textContent='Eliminar tramo';
      remove.addEventListener('click',()=>{ const next=structuredClone(getState().transport.segments); next.splice(index,1); updateState({transport:{segments:next}}); renderParameterSections(); });
      card.append(remove); body.append(card);
    });
    const add = document.createElement('button'); add.type='button'; add.className='segment-action'; add.textContent='+ Añadir tramo';
    add.addEventListener('click',()=>{ const next=structuredClone(getState().transport.segments); const source=next.at(-1) ?? getState().transport.pipe1; next.push({id:`S${next.length+1}`,innerDiameterM:source.innerDiameterM,lengthM:10,roughnessM:source.roughnessM,material:source.material,elevationChangeM:0,minorLossCoefficient:0,accessories:{valvesCount:0,valveK:0.2,elbowsCount:0,elbowK:0.9,teesCount:0,teeK:1.8,reducersCount:0,reducerK:0.4,otherK:0}}); updateState({transport:{segments:next}}); renderParameterSections(); });
    body.append(add);
  }
  details.append(body);
  return details;
}

function createPumpCurveEditor(state) {
  const details = document.createElement('details');
  details.className = 'parameter-section pump-curve-editor';
  const summary = document.createElement('summary');
  summary.textContent = '08 / Curvas de bomba';
  details.append(summary);
  const body = document.createElement('div');
  body.className = 'section-content pump-curve-body';
  const note = document.createElement('p');
  note.className = 'empty-section';
  note.textContent = 'Tabla H–Q con eficiencia y NPSHr opcionales. No se extrapola fuera del intervalo ingresado.';
  body.append(note);
  const rows = state.energy.pumpCurve ?? [];
  if (!rows.length) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'segment-action';
    button.textContent = 'Cargar curva académica de ejemplo';
    button.addEventListener('click', () => {
      updateState({ energy: {
        pumpCurve: [
          { flowRateM3s: 0, headM: 60 },
          { flowRateM3s: 0.025, headM: 52 },
          { flowRateM3s: 0.05, headM: 36 },
          { flowRateM3s: 0.075, headM: 12 },
        ],
        efficiencyCurve: [
          { flowRateM3s: 0, efficiency: 0.45 },
          { flowRateM3s: 0.025, efficiency: 0.72 },
          { flowRateM3s: 0.05, efficiency: 0.80 },
          { flowRateM3s: 0.075, efficiency: 0.68 },
        ],
        npshrCurve: [
          { flowRateM3s: 0, npshM: 1.5 },
          { flowRateM3s: 0.025, npshM: 2.1 },
          { flowRateM3s: 0.05, npshM: 3.2 },
          { flowRateM3s: 0.075, npshM: 5.0 },
        ],
      } });
      renderParameterSections();
    });
    body.append(button);
  } else {
    const table = document.createElement('div');
    table.className = 'pump-curve-table';
    table.innerHTML = '<div class="pump-row pump-head"><span>Q · m³/h</span><span>H · m</span><span>η · %</span><span>NPSHr · m</span><span></span></div>';
    rows.forEach((point, index) => {
      const row = document.createElement('div');
      row.className = 'pump-row';
      const values = [
        point.flowRateM3s * 3600,
        point.headM,
        state.energy.efficiencyCurve?.[index]?.efficiency !== undefined ? state.energy.efficiencyCurve[index].efficiency * 100 : '',
        state.energy.npshrCurve?.[index]?.npshM ?? '',
      ];
      values.forEach((value, column) => {
        const input = document.createElement('input');
        input.type = 'number';
        input.step = column === 0 ? '0.1' : column === 2 ? '0.1' : '0.01';
        input.value = value;
        input.addEventListener('change', () => {
          const pumpCurve = structuredClone(getState().energy.pumpCurve);
          const efficiencyCurve = structuredClone(getState().energy.efficiencyCurve);
          const npshrCurve = structuredClone(getState().energy.npshrCurve);
          const q = column === 0 ? Number(input.value) / 3600 : pumpCurve[index].flowRateM3s;
          if (column === 0) {
            pumpCurve[index].flowRateM3s = q;
            if (efficiencyCurve[index]) efficiencyCurve[index].flowRateM3s = q;
            if (npshrCurve[index]) npshrCurve[index].flowRateM3s = q;
          } else if (column === 1) pumpCurve[index].headM = Number(input.value);
          else if (column === 2) {
            while (efficiencyCurve.length <= index) efficiencyCurve.push({ flowRateM3s: pumpCurve[efficiencyCurve.length].flowRateM3s, efficiency: 0 });
            efficiencyCurve[index].efficiency = Number(input.value) / 100;
          } else {
            while (npshrCurve.length <= index) npshrCurve.push({ flowRateM3s: pumpCurve[npshrCurve.length].flowRateM3s, npshM: 0 });
            npshrCurve[index].npshM = Number(input.value);
          }
          updateState({ energy: { pumpCurve, efficiencyCurve, npshrCurve } });
        });
        row.append(input);
      });
      const remove = document.createElement('button');
      remove.type = 'button'; remove.textContent = '×'; remove.title = 'Eliminar punto';
      remove.addEventListener('click', () => {
        const pumpCurve = structuredClone(getState().energy.pumpCurve);
        const efficiencyCurve = structuredClone(getState().energy.efficiencyCurve);
        const npshrCurve = structuredClone(getState().energy.npshrCurve);
        pumpCurve.splice(index, 1); efficiencyCurve.splice(index, 1); npshrCurve.splice(index, 1);
        updateState({ energy: { pumpCurve, efficiencyCurve, npshrCurve } }); renderParameterSections();
      });
      row.append(remove); table.append(row);
    });
    body.append(table);
    const actions = document.createElement('div'); actions.className = 'pump-curve-actions';
    const add = document.createElement('button'); add.type='button'; add.className='segment-action'; add.textContent='+ Punto';
    add.addEventListener('click',()=>{ const s=getState(); const pumpCurve=structuredClone(s.energy.pumpCurve); const efficiencyCurve=structuredClone(s.energy.efficiencyCurve); const npshrCurve=structuredClone(s.energy.npshrCurve); const last=pumpCurve.at(-1); const q=(last?.flowRateM3s??0)+0.01; pumpCurve.push({flowRateM3s:q,headM:Math.max(0,(last?.headM??20)-5)}); efficiencyCurve.push({flowRateM3s:q,efficiency:efficiencyCurve.at(-1)?.efficiency??0.75}); npshrCurve.push({flowRateM3s:q,npshM:(npshrCurve.at(-1)?.npshM??2)+0.5}); updateState({energy:{pumpCurve,efficiencyCurve,npshrCurve}}); renderParameterSections(); });
    const clear = document.createElement('button'); clear.type='button'; clear.className='segment-remove'; clear.textContent='Quitar curvas'; clear.addEventListener('click',()=>{updateState({energy:{pumpCurve:[],efficiencyCurve:[],npshrCurve:[]}});renderParameterSections();});
    actions.append(add,clear); body.append(actions);
  }
  details.append(body);
  return details;
}

function wireThemeEditor() {
  const panel = document.querySelector('#theme-panel');
  const toggle = document.querySelector('#theme-toggle');
  toggle?.addEventListener('click', () => {
    if (panel) panel.hidden = !panel.hidden;
  });
  if (!panel) return;
  panel.innerHTML = `<div class="theme-panel-head"><strong>Paletas del simulador</strong><button id="theme-reset" type="button">Predeterminada</button></div><p>Elige una combinación completa. La paleta cambia la apariencia, nunca la física.</p><div class="palette-presets"></div>`;
  const host = panel.querySelector('.palette-presets');
  Object.entries(PALETTE_PRESETS).forEach(([id, preset]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.palettePreset = id;
    button.innerHTML = `<span class="palette-swatch" style="--swatch-accent:${preset.theme.accent};--swatch-bg:${preset.theme.background};--swatch-panel:${preset.theme.panel}"></span><span><strong>${preset.label}</strong><small>${preset.description}</small></span>`;
    button.addEventListener('click', () => {
      activeTheme = applyTheme(saveTheme(preset.theme));
      activeScenePalette = saveScenePalette(preset.scene);
      environmentHandle?.setScenePalette(paletteHexToNumbers(activeScenePalette));
      host.querySelectorAll('button').forEach((item) => item.classList.toggle('active', item === button));
    });
    host.append(button);
  });
  panel.querySelector('#theme-reset')?.addEventListener('click', () => {
    resetTheme();
    resetScenePalette();
    const preset = getPalettePreset('industrial');
    activeTheme = applyTheme(preset.theme);
    activeScenePalette = saveScenePalette(preset.scene);
    environmentHandle?.setScenePalette(paletteHexToNumbers(activeScenePalette));
    host.querySelectorAll('button').forEach((item) => item.classList.toggle('active', item.dataset.palettePreset === 'industrial'));
  });
}

function compactScenarioPanel() {
  const panel = document.querySelector('.scenario-panel');
  if (!panel) return;
  const select = panel.querySelector('#scenario-select');
  const controls = panel.querySelector('.scenario-controls');
  const name = panel.querySelector('#scenario-name');
  if (!select || !controls) return;
  panel.classList.add('scenario-panel-compact');
  const primary = document.createElement('div');
  primary.className = 'scenario-primary-row';
  primary.append(select);
  ['scenario-save', 'scenario-load', 'scenario-compare'].forEach((id) => {
    const button = controls.querySelector(`#${id}`);
    if (button) primary.append(button);
  });
  const more = document.createElement('details');
  more.className = 'scenario-more';
  more.innerHTML = '<summary aria-label="Más acciones de escenario">⋯</summary><div class="scenario-more-actions"></div>';
  const moreActions = more.querySelector('.scenario-more-actions');
  ['scenario-delete', 'scenario-export-json', 'scenario-export-csv', 'scenario-reset'].forEach((id) => {
    const button = controls.querySelector(`#${id}`);
    if (button) moreActions.append(button);
  });
  primary.append(more);
  panel.replaceChildren(name, primary);
  const comparison = document.createElement('div');
  comparison.id = 'scenario-comparison';
  comparison.className = 'scenario-comparison';
  comparison.hidden = true;
  panel.append(comparison);
}

function formatScenarioValue(value) {
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : Number(value.toPrecision(6)).toString();
  return String(value ?? '—');
}

function formatScenarioDelta(left, right) {
  if (typeof left !== 'number' || typeof right !== 'number') return ['—', '—'];
  const delta = right - left;
  const relative = Math.abs(left) > 1e-12 ? delta / left * 100 : null;
  return [formatScenarioValue(delta), relative === null ? '—' : `${relative >= 0 ? '+' : ''}${relative.toFixed(2)} %`];
}

function renderScenarioComparison(scenario) {
  const host = document.querySelector('#scenario-comparison');
  const engineeringHost = document.querySelector('#engineering-comparison');
  if (!host && !engineeringHost) return;
  activeComparisonScenarioId = scenario?.id ?? null;
  const diffs = compareScenarios(scenario, getState());
  const defaultState = getInitialState();
  const savedState = structuredClone(defaultState);
  Object.entries(scenario.inputs ?? {}).forEach(([section, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) savedState[section] = { ...savedState[section], ...value };
    else savedState[section] = value;
  });
  if (scenario.inputs?.transport?.pipe1) savedState.transport.pipe1 = { ...defaultState.transport.pipe1, ...scenario.inputs.transport.pipe1 };
  const savedResults = calculateSimulationResults(savedState);
  const currentResults = getResults();
  const currentState = getState();
  const resultRows = [
    ['Q · caudal', savedResults.transport?.flowRateM3s === undefined ? undefined : savedResults.transport.flowRateM3s * 3600, currentResults.transport?.flowRateM3s === undefined ? undefined : currentResults.transport.flowRateM3s * 3600, 'm³/h'],
    ['V · velocidad', savedState.transport?.pipe1?.velocityMps, currentState.transport?.pipe1?.velocityMps, 'm/s'],
    ['Re · Reynolds', savedResults.transport?.reynoldsNumber, currentResults.transport?.reynoldsNumber, ''],
    ['f · Darcy', savedResults.transport?.frictionFactor, currentResults.transport?.frictionFactor, ''],
    ['ΔP total', savedResults.transport?.pressureDropPa === undefined ? undefined : savedResults.transport.pressureDropPa / 1000, currentResults.transport?.pressureDropPa === undefined ? undefined : currentResults.transport.pressureDropPa / 1000, 'kPa'],
    ['H · carga', savedResults.transport?.totalHeadM, currentResults.transport?.totalHeadM, 'm'],
    ['P · eléctrica', savedResults.energy?.electricalPowerW === undefined ? undefined : savedResults.energy.electricalPowerW / 1000, currentResults.energy?.electricalPowerW === undefined ? undefined : currentResults.energy.electricalPowerW / 1000, 'kW'],
    ['NPSH-A', savedResults.pump?.npshAvailableM, currentResults.pump?.npshAvailableM, 'm'],
    ['Densidad pulpa', savedResults.slurry?.densityKgM3, currentResults.slurry?.densityKgM3, 'kg/m³'],
    ['Recuperación', savedResults.recovery?.overallRecovery === undefined ? undefined : savedResults.recovery.overallRecovery * 100, currentResults.recovery?.overallRecovery === undefined ? undefined : currentResults.recovery.overallRecovery * 100, '%'],
  ].filter(([, left, right]) => left !== undefined || right !== undefined);
  const inputHtml = diffs.length ? diffs.slice(0, 20).map(({ key, left, right }) => {
    const [delta, relative] = formatScenarioDelta(left, right);
    return `<tr><td>${key}</td><td>${formatScenarioValue(left)}</td><td>${formatScenarioValue(right)}</td><td>${delta}</td><td>${relative}</td></tr>`;
  }).join('') : '<tr><td colspan="5">Sin diferencias de entrada.</td></tr>';
  const resultHtml = resultRows.map(([name, left, right, unit]) => {
    const [delta, relative] = formatScenarioDelta(left, right);
    return `<tr><td>${name}</td><td>${formatScenarioValue(left)}${unit ? ` ${unit}` : ''}</td><td>${formatScenarioValue(right)}${unit ? ` ${unit}` : ''}</td><td>${delta}${unit ? ` ${unit}` : ''}</td><td>${relative}</td></tr>`;
  }).join('');
  const closeComparison = () => {
    activeComparisonScenarioId = null;
    if (host) host.hidden = true;
    if (engineeringHost) engineeringHost.hidden = true;
  };
  if (host) {
    host.innerHTML = `<div class="scenario-comparison-head"><strong>Comparación A/B</strong><button type="button" aria-label="Cerrar comparación">×</button></div><table><thead><tr><th>Entrada</th><th>A</th><th>B</th><th>Δ</th><th>Δ %</th></tr></thead><tbody>${inputHtml}</tbody></table>`;
    host.hidden = false;
    host.querySelector('button')?.addEventListener('click', closeComparison);
  }
  if (engineeringHost) {
    engineeringHost.innerHTML = `<div class="engineering-comparison-head"><div><span>COMPARACIÓN DE ESCENARIOS</span><strong>${scenario.name} vs escenario actual</strong></div><button type="button" aria-label="Cerrar comparación técnica">×</button></div><table><thead><tr><th>Variable</th><th>Escenario A</th><th>Escenario B</th><th>Δ</th><th>Δ %</th></tr></thead><tbody>${resultHtml}</tbody></table>`;
    engineeringHost.hidden = false;
    engineeringHost.querySelector('button')?.addEventListener('click', closeComparison);
  }
}

function setScenarioStatus(message, tone = 'muted') {
  const node = document.querySelector('#scenario-status');
  if (!node) return;
  node.textContent = message;
  node.dataset.tone = tone;
}

function refreshScenarioSelect() {
  const select = document.querySelector('#scenario-select');
  if (!select) return;
  const previous = select.value;
  select.replaceChildren(new Option('Seleccionar escenario…', ''));
  listScenarios().forEach((scenario) => select.append(new Option(scenario.name, scenario.id)));
  if ([...select.options].some((option) => option.value === previous)) select.value = previous;
}

function downloadText(filename, content, type) {
  const blob = new Blob([content], { type });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function wireScenarioControls() {
  const nameInput = document.querySelector('#scenario-name');
  const select = document.querySelector('#scenario-select');
  document.querySelector('#scenario-save')?.addEventListener('click', () => {
    try {
      const existingId = select?.value || null;
      const saved = saveNamedScenario({ name: nameInput?.value || 'Escenario', state: getState(), id: existingId });
      refreshScenarioSelect();
      if (select) select.value = saved.id;
      setScenarioStatus(`Guardado: ${saved.name}.`, 'success');
    } catch (error) {
      setScenarioStatus(error.message, 'warning');
    }
  });
  document.querySelector('#scenario-load')?.addEventListener('click', () => {
    const scenario = loadNamedScenario(select?.value);
    if (!scenario) {
      setScenarioStatus('Selecciona un escenario guardado.', 'warning');
      return;
    }
    try {
      resetState();
      updateState(scenario.inputs);
      renderParameterSections();
      if (nameInput) nameInput.value = scenario.name;
      setScenarioStatus(`Cargado: ${scenario.name}.`, 'success');
    } catch (error) {
      setScenarioStatus(`Escenario incompatible: ${error.message}`, 'warning');
    }
  });
  document.querySelector('#scenario-reset')?.addEventListener('click', () => {
    loadExampleSimulation(updateState, resetState);
    renderParameterSections();
    renderError('');
    setScenarioStatus('Parámetros de ejemplo restaurados. El escenario guardado se conserva.', 'muted');
  });
  document.querySelector('#scenario-delete')?.addEventListener('click', () => {
    if (!select?.value) return setScenarioStatus('Selecciona un escenario para borrar.', 'warning');
    deleteNamedScenario(select.value);
    refreshScenarioSelect();
    setScenarioStatus('Escenario eliminado.', 'muted');
  });
  document.querySelector('#scenario-compare')?.addEventListener('click', () => {
    const scenario = loadNamedScenario(select?.value);
    if (!scenario) return setScenarioStatus('Selecciona un escenario para comparar.', 'warning');
    const diffs = compareScenarios(scenario, getState());
    setScenarioStatus(diffs.length ? `${diffs.length} diferencias vs. estado actual.` : 'Sin diferencias vs. estado actual.', diffs.length ? 'warning' : 'success');
    renderScenarioComparison(scenario);
  });
  document.querySelector('#scenario-export-json')?.addEventListener('click', () => {
    downloadText('pulpa-lab-scenario.json', exportScenarioJson(nameInput?.value, getState()), 'application/json');
  });
  document.querySelector('#scenario-export-csv')?.addEventListener('click', () => {
    downloadText('pulpa-lab-scenario.csv', exportScenarioCsv(nameInput?.value, getState()), 'text/csv');
  });
  refreshScenarioSelect();
}

function renderAcademicCaseGuide(caseId) {
  const guide = document.querySelector('#academic-case-guide');
  const selected = getAcademicCase(caseId);
  if (!guide || !selected) {
    if (guide) {
      guide.hidden = true;
      guide.replaceChildren();
    }
    return;
  }
  guide.innerHTML = '<header><span>' + selected.shortName + '</span><strong>' + selected.objective + '</strong></header>'
    + '<p class="academic-question">' + selected.question + '</p>'
    + '<div class="academic-observe"><b>Observa</b>' + selected.observe.map((item) => '<span>' + item + '</span>').join('') + '</div>'
    + '<p class="academic-caution"><b>Alcance:</b> ' + selected.caution + '</p>';
  guide.hidden = false;
}

function setAcademicCaseStatus(message, tone = 'muted') {
  const node = document.querySelector('#academic-case-status');
  if (!node) return;
  node.textContent = message;
  node.dataset.tone = tone;
}

function formatAcademicComparisonNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 10000) return Math.round(value).toLocaleString('es-PE');
  if (abs >= 100) return value.toFixed(1);
  if (abs >= 10) return value.toFixed(2);
  if (abs >= 1) return value.toFixed(3);
  return value.toPrecision(4);
}

function renderAcademicComparison() {
  const leftSelect = document.querySelector('#academic-compare-left');
  const rightSelect = document.querySelector('#academic-compare-right');
  const host = document.querySelector('#academic-comparison-result');
  if (!host) return;
  try {
    const comparison = compareAcademicCases(leftSelect?.value, rightSelect?.value);
    const differingMetrics = comparison.metrics.filter((row) => (
      row.delta === null
        ? row.left !== row.right
        : Math.abs(row.delta) > 1e-9
    ));
    const metricRows = differingMetrics.length ? differingMetrics.map((row) => {
      const delta = row.delta === null ? '—' : (row.delta > 0 ? '+' : '') + formatAcademicComparisonNumber(row.delta);
      const percent = row.percentDelta === null ? '' : ' <small>(' + (row.percentDelta > 0 ? '+' : '') + row.percentDelta.toFixed(1) + '%)</small>';
      return '<tr><th>' + row.label + '</th><td>' + formatAcademicComparisonNumber(row.left) + ' ' + row.unit + '</td><td>' + formatAcademicComparisonNumber(row.right) + ' ' + row.unit + '</td><td>' + delta + ' ' + row.unit + percent + '</td></tr>';
    }).join('') : '<tr><td colspan="4">Sin diferencias en las métricas resumidas.</td></tr>';
    const insightCards = comparison.insights.map((item) => '<article><strong>' + item.title + '</strong><p>' + item.explanation + '</p></article>').join('');
    host.innerHTML = '<div class="academic-comparison-head"><span>A · ' + comparison.leftCase.shortName + '</span><span>B · ' + comparison.rightCase.shortName + '</span></div>'
      + '<div class="academic-comparison-quality"><span>A: ' + (comparison.leftResults.transport?.flowRegime ?? '—') + ' · ' + (comparison.leftResults.transport?.resultQuality ?? 'validated') + '</span><span>B: ' + (comparison.rightResults.transport?.flowRegime ?? '—') + ' · ' + (comparison.rightResults.transport?.resultQuality ?? 'validated') + '</span></div>'
      + '<div class="academic-comparison-table-wrap"><table><thead><tr><th>Métrica</th><th>A</th><th>B</th><th>Δ B−A</th></tr></thead><tbody>' + metricRows + '</tbody></table></div>'
      + '<div class="academic-comparison-insights"><h4>¿Por qué cambia?</h4>' + insightCards + '</div>';
    host.hidden = false;
  } catch (error) {
    host.innerHTML = '<p class="academic-comparison-error">' + error.message + '</p>';
    host.hidden = false;
  }
}

function wireAcademicCaseControls() {
  const select = document.querySelector('#academic-case-select');
  const loadButton = document.querySelector('#academic-case-load');
  const presentButton = document.querySelector('#academic-case-present');
  const compareLeft = document.querySelector('#academic-compare-left');
  const compareRight = document.querySelector('#academic-compare-right');
  const compareRun = document.querySelector('#academic-compare-run');
  if (!select) return;
  ACADEMIC_CASES.forEach((item) => {
    select.append(new Option(item.name, item.id));
    compareLeft?.append(new Option(item.shortName, item.id));
    compareRight?.append(new Option(item.shortName, item.id));
  });
  if (compareLeft) compareLeft.value = 'newtonian-reference';
  if (compareRight) compareRight.value = 'high-solids-bingham';
  compareRun?.addEventListener('click', renderAcademicComparison);
  select.addEventListener('change', () => {
    renderAcademicCaseGuide(select.value);
    const selected = getAcademicCase(select.value);
    setAcademicCaseStatus(
      selected ? 'Caso seleccionado: ' + selected.shortName + '. Aún no modifica parámetros.' : 'Valores académicos de referencia: revisar siempre el alcance del modelo.',
      'muted',
    );
  });
  const loadSelected = (present = false) => {
    const selected = getAcademicCase(select.value);
    if (!selected) {
      setAcademicCaseStatus('Selecciona primero un caso académico.', 'warning');
      return;
    }
    try {
      loadAcademicCase(selected.id, updateState, resetState);
      renderParameterSections();
      renderError('');
      const nameInput = document.querySelector('#scenario-name');
      const savedScenarioSelect = document.querySelector('#scenario-select');
      if (nameInput) nameInput.value = selected.name;
      if (savedScenarioSelect) savedScenarioSelect.value = '';
      setScenarioStatus('Caso académico activo: ' + selected.shortName + '. Puedes modificarlo y guardarlo como escenario propio.', 'success');
      setAcademicCaseStatus('Cargado: ' + selected.shortName + '. Compara KPIs, curvas y memoria de cálculo.', 'success');
      renderAcademicCaseGuide(selected.id);
      if (present) {
        if (startPresentationTour) startPresentationTour(selected.presentationStartId);
        else setAcademicCaseStatus('Cargado: ' + selected.shortName + '. El entorno 3D todavía se está inicializando; inicia Presentación cuando esté listo.', 'warning');
      }
    } catch (error) {
      setAcademicCaseStatus('No se pudo cargar el caso: ' + error.message, 'warning');
    }
  };
  loadButton?.addEventListener('click', () => loadSelected(false));
  presentButton?.addEventListener('click', () => loadSelected(true));
}

const ACADEMIC_PREDICTION_LABELS = Object.freeze({
  sube: 'Sube',
  baja: 'Baja',
  igual: 'Igual',
  'no-se': 'No sé',
});

function setAcademicLabStatus(message, tone = 'muted') {
  const node = document.querySelector('#academic-lab-status');
  if (!node) return;
  node.textContent = message;
  node.dataset.tone = tone;
}

function installAcademicLabPanel() {
  const panel = document.querySelector('.academic-case-panel');
  if (!panel || document.querySelector('#academic-lab')) return;
  const badge = panel.querySelector('.academic-case-heading small');
  if (badge) badge.textContent = RELEASE_INFO.version;
  const details = document.createElement('details');
  details.id = 'academic-lab';
  details.className = 'academic-lab';
  details.innerHTML = '<summary>Laboratorio interactivo</summary>'
    + '<div class="academic-lab-body">'
    + '<label class="academic-lab-select-label">Experimento<select id="academic-lab-select" aria-label="Experimento de laboratorio"></select></label>'
    + '<div id="academic-lab-guide" class="academic-lab-guide"></div>'
    + '<fieldset class="academic-lab-hypotheses"><legend>1 · Formula tu hipótesis antes de ejecutar</legend><div id="academic-lab-predictions"></div></fieldset>'
    + '<div class="academic-lab-actions"><button id="academic-lab-run" type="button">2 · Evaluar hipótesis</button><button id="academic-lab-load-b" type="button" disabled>Cargar caso B</button><button id="academic-lab-report" type="button" disabled>Descargar informe HTML</button></div>'
    + '<p id="academic-lab-status" class="academic-lab-status" data-tone="muted" aria-live="polite">Selecciona un experimento y completa las predicciones antes de ejecutar.</p>'
    + '<div id="academic-lab-result" class="academic-lab-result" hidden></div>'
    + '</div>';
  panel.append(details);
}

function renderAcademicLabExperiment(experimentId) {
  const experiment = getAcademicExperiment(experimentId);
  const guide = document.querySelector('#academic-lab-guide');
  const predictions = document.querySelector('#academic-lab-predictions');
  const result = document.querySelector('#academic-lab-result');
  const reportButton = document.querySelector('#academic-lab-report');
  const loadBButton = document.querySelector('#academic-lab-load-b');
  if (!experiment || !guide || !predictions) return;
  lastAcademicLabEvaluation = null;
  if (result) {
    result.hidden = true;
    result.replaceChildren();
  }
  if (reportButton) reportButton.disabled = true;
  if (loadBButton) loadBButton.disabled = true;
  guide.innerHTML = '<header><span>' + experiment.baseCase.shortName + ' → ' + experiment.interventionCase.shortName + '</span><strong>' + experiment.name + '</strong></header>'
    + '<p>' + experiment.objective + '</p>'
    + '<p class="academic-lab-question">' + experiment.question + '</p>';
  predictions.replaceChildren();
  experiment.predictions.forEach((definition) => {
    const label = document.createElement('label');
    label.className = 'academic-lab-prediction';
    const text = document.createElement('span');
    text.textContent = definition.label;
    const predictionSelect = document.createElement('select');
    predictionSelect.dataset.labPrediction = definition.key;
    predictionSelect.setAttribute('aria-label', 'Predicción para ' + definition.label);
    predictionSelect.append(new Option('Elegir…', ''));
    definition.options.forEach((value) => predictionSelect.append(new Option(ACADEMIC_PREDICTION_LABELS[value], value)));
    predictionSelect.addEventListener('change', () => {
      lastAcademicLabEvaluation = null;
      if (result) {
        result.hidden = true;
        result.replaceChildren();
      }
      if (reportButton) reportButton.disabled = true;
      if (loadBButton) loadBButton.disabled = true;
      const all = [...predictions.querySelectorAll('[data-lab-prediction]')];
      const answered = all.filter((node) => node.value).length;
      setAcademicLabStatus('Hipótesis preparada: ' + answered + '/' + all.length + ' variables.', answered === all.length ? 'success' : 'muted');
    });
    label.append(text, predictionSelect);
    predictions.append(label);
  });
  setAcademicLabStatus('Formula una predicción para cada variable antes de ejecutar.', 'muted');
}

function collectAcademicLabHypotheses() {
  const fields = [...document.querySelectorAll('#academic-lab-predictions [data-lab-prediction]')];
  if (!fields.length || fields.some((field) => !field.value)) return null;
  return Object.fromEntries(fields.map((field) => [field.dataset.labPrediction, field.value]));
}

function renderAcademicLabEvaluation(evaluation) {
  const host = document.querySelector('#academic-lab-result');
  if (!host) return;
  const score = evaluation.score;
  const rows = evaluation.evaluations.map((item) => {
    const delta = Number.isFinite(item.delta)
      ? ((item.delta > 0 ? '+' : '') + formatAcademicComparisonNumber(item.delta) + ' ' + item.unit).trim()
      : '—';
    const verdict = item.matches ? '✓ Coincide' : '✕ Revisa';
    return '<tr><th>' + item.label + '</th><td>' + (ACADEMIC_PREDICTION_LABELS[item.predicted] ?? '—') + '</td><td>' + (ACADEMIC_PREDICTION_LABELS[item.actual] ?? '—') + '</td><td>' + delta + '</td><td data-match="' + (item.matches ? 'true' : 'false') + '">' + verdict + '</td></tr>';
  }).join('');
  const baseQuality = evaluation.resultQuality.base;
  const interventionQuality = evaluation.resultQuality.intervention;
  const scope = evaluation.scope.limited
    ? '<p class="academic-lab-scope"><b>Límite de aplicabilidad:</b> ' + (evaluation.scope.insight?.explanation ?? 'Al menos un caso requiere cautela de interpretación.') + '</p>'
    : '<p class="academic-lab-scope is-valid"><b>Alcance:</b> ambos casos permanecen dentro de la calidad reportada por el solver.</p>';
  host.innerHTML = '<div class="academic-lab-score"><strong>' + score.correct + '/' + score.answered + '</strong><span>hipótesis coincidentes</span></div>'
    + '<div class="academic-lab-quality"><span>A · ' + (baseQuality.flowRegime ?? '—') + ' · ' + baseQuality.resultQuality + '</span><span>B · ' + (interventionQuality.flowRegime ?? '—') + ' · ' + interventionQuality.resultQuality + '</span></div>'
    + '<div class="academic-lab-table-wrap"><table><thead><tr><th>Métrica</th><th>Predije</th><th>Ocurrió</th><th>Δ B−A</th><th>Evaluación</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
    + scope
    + '<div class="academic-lab-conclusion"><b>Conclusión causal</b><p>' + evaluation.conclusion.text + '</p></div>';
  host.hidden = false;
}

function academicLabHypothesisText(evaluation) {
  return evaluation.evaluations
    .map((item) => item.label + ': se predijo “' + (ACADEMIC_PREDICTION_LABELS[item.predicted] ?? 'sin respuesta') + '”.')
    .join(' ');
}

function wireAcademicLabControls() {
  installAcademicLabPanel();
  const select = document.querySelector('#academic-lab-select');
  const runButton = document.querySelector('#academic-lab-run');
  const reportButton = document.querySelector('#academic-lab-report');
  const loadBButton = document.querySelector('#academic-lab-load-b');
  if (!select) return;
  ACADEMIC_LAB_EXPERIMENTS.forEach((experiment) => {
    select.append(new Option(experiment.name.replace(/^Experimento \d+ · /, ''), experiment.id));
  });
  select.value = ACADEMIC_LAB_EXPERIMENTS[0]?.id ?? '';
  renderAcademicLabExperiment(select.value);
  select.addEventListener('change', () => renderAcademicLabExperiment(select.value));
  runButton?.addEventListener('click', () => {
    const hypotheses = collectAcademicLabHypotheses();
    if (!hypotheses) {
      setAcademicLabStatus('Completa todas las predicciones antes de evaluar. “No sé” también es una hipótesis válida.', 'warning');
      return;
    }
    try {
      const evaluation = evaluateAcademicHypotheses(select.value, hypotheses);
      lastAcademicLabEvaluation = evaluation;
      renderAcademicLabEvaluation(evaluation);
      if (reportButton) reportButton.disabled = false;
      if (loadBButton) loadBButton.disabled = false;
      setAcademicLabStatus(
        'Evaluación completada: ' + evaluation.score.correct + '/' + evaluation.score.answered + ' predicciones coinciden con el modelo.',
        evaluation.score.correct === evaluation.score.answered ? 'success' : 'warning',
      );
    } catch (error) {
      setAcademicLabStatus('No se pudo evaluar: ' + error.message, 'warning');
    }
  });
  reportButton?.addEventListener('click', () => {
    if (!lastAcademicLabEvaluation) return;
    const html = buildAcademicLabReportHtml({
      comparison: lastAcademicLabEvaluation.comparison,
      title: lastAcademicLabEvaluation.experiment.name,
      hypothesis: academicLabHypothesisText(lastAcademicLabEvaluation),
      conclusion: lastAcademicLabEvaluation.conclusion.text,
    });
    downloadText('pulpa-lab-v20-' + lastAcademicLabEvaluation.experiment.id + '.html', html, 'text/html');
    setAcademicLabStatus('Informe HTML generado. Puedes abrirlo, imprimirlo o guardarlo como PDF desde el navegador.', 'success');
  });
  loadBButton?.addEventListener('click', () => {
    if (!lastAcademicLabEvaluation) return;
    const selected = lastAcademicLabEvaluation.experiment.interventionCase;
    try {
      loadAcademicCase(selected.id, updateState, resetState);
      renderParameterSections();
      renderError('');
      const scenarioName = document.querySelector('#scenario-name');
      const savedScenarioSelect = document.querySelector('#scenario-select');
      if (scenarioName) scenarioName.value = selected.name;
      if (savedScenarioSelect) savedScenarioSelect.value = '';
      setScenarioStatus('Intervención del laboratorio cargada: ' + selected.shortName + '.', 'success');
      setAcademicLabStatus('Caso B cargado en el simulador: ' + selected.shortName + '. La evaluación A/B permanece como evidencia de la práctica.', 'success');
    } catch (error) {
      setAcademicLabStatus('No se pudo cargar el caso B: ' + error.message, 'warning');
    }
  });
}

const WORKSPACE_TABS = Object.freeze([
  ['circuit', '01', 'Entradas y modelo'],
  ['curves', '02', 'Resultados y curvas'],
  ['balance', '03', 'Análisis hidráulico'],
  ['memory', '04', 'Memoria y supuestos'],
]);

function installWorkspaceTabs(shell) {
  const content = shell.querySelector('.content');
  if (!content) return;
  const existing = [...content.children];
  const nav = document.createElement('nav');
  nav.className = 'workspace-tabs';
  nav.setAttribute('aria-label', 'Áreas del simulador');
  WORKSPACE_TABS.forEach(([id, number, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.workspaceTab = id;
    button.classList.toggle('active', id === activeWorkspaceTab);
    button.setAttribute('aria-selected', String(id === activeWorkspaceTab));
    button.innerHTML = `<span>${number}</span>${label}`;
    nav.append(button);
  });
  content.replaceChildren(nav);

  const circuit = document.createElement('section');
  circuit.className = 'workspace-tab-panel';
  circuit.dataset.tabPanel = 'circuit';
  existing.forEach((node) => circuit.append(node));
  content.append(circuit);

  const placeholders = [
    ['curves', 'RESULTADOS', 'Curvas y respuesta del sistema', 'Reología, perfil radial, curva del sistema, bomba y sondas calculadas por el mismo motor numérico.'],
    ['balance', 'ANÁLISIS', 'Hidráulica, energía y sensibilidad', 'Desglose de presión, continuidad, punto de operación, energía y sensibilidad del circuito activo.'],
    ['memory', 'TRAZABILIDAD', 'Memoria, ecuaciones y supuestos', 'Ecuaciones, sustitución numérica, supuestos, resultados y referencias del escenario activo.'],
  ];
  placeholders.forEach(([id, eyebrow, title, description]) => {
    const panel = document.createElement('section');
    panel.className = 'workspace-tab-panel workspace-tab-placeholder';
    panel.dataset.tabPanel = id;
    panel.innerHTML = `<div class="tab-placeholder-card"><p class="eyebrow">${eyebrow}</p><h2>${title}</h2><p>${description}</p><div id="${id}-tab-root"></div></div>`;
    content.append(panel);
  });

  const activate = (id) => {
    if (!WORKSPACE_TABS.some(([tabId]) => tabId === id)) return;
    activeWorkspaceTab = id;
    content.querySelectorAll('[data-workspace-tab]').forEach((button) => {
      const active = button.dataset.workspaceTab === id;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    content.querySelectorAll('[data-tab-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.tabPanel !== id;
    });
    if (id === 'circuit') queueMicrotask(() => environmentHandle?.resize?.());
    else queueMicrotask(() => renderScientificWorkspace(id));
  };
  nav.addEventListener('click', (event) => {
    const button = event.target.closest('[data-workspace-tab]');
    if (button) activate(button.dataset.workspaceTab);
  });
  activate(activeWorkspaceTab);
}

function renderScientificWorkspace(tabId = activeWorkspaceTab) {
  const state = getState();
  const results = getResults();
  if (tabId === 'curves') renderCurvesAndProbes(document.querySelector('#curves-tab-root'), { state, results, calculate: calculateSimulationResults });
  if (tabId === 'balance') {
    const root = document.querySelector('#balance-tab-root');
    renderBalanceAndEnergy(root, { state, results });
    renderSensitivityPanel(root?.querySelector('#sensitivity-root'), { state, calculate: calculateSimulationResults });
  }
  if (tabId === 'memory') {
    const selectedScenario = loadNamedScenario(document.querySelector('#scenario-select')?.value);
    renderMemoryPanel(document.querySelector('#memory-tab-root'), { state, results, scenarioName: selectedScenario?.name ?? 'Escenario actual' });
  }
}

function inspectionMetricRows(id, state, results) {
  const t = results.transport ?? {};
  const p = results.pump ?? {};
  const e = results.energy ?? {};
  const slurry = results.slurry ?? {};
  const recovery = results.recovery ?? {};
  const leaching = results.leaching ?? {};
  const qM3h = t.flowRateM3s === undefined ? null : t.flowRateM3s * 3600;
  const rows = [];
  const add = (label, value) => { if (value !== null && value !== undefined) rows.push([label, value]); };
  if (['SLURRY-PUMP-01', 'PUMP-01'].includes(id)) {
    add('Q', qM3h === null ? '—' : `${qM3h.toFixed(2)} m³/h`);
    add('ΔP requerida', t.pressureDropPa === undefined ? '—' : `${(t.pressureDropPa / 1000).toFixed(2)} kPa`);
    add('Carga H', t.totalHeadM === undefined ? '—' : `${t.totalHeadM.toFixed(2)} m`);
    add('Potencia', e.electricalPowerW === undefined ? '—' : `${(e.electricalPowerW / 1000).toFixed(2)} kW`);
    add('NPSH-A', p.npshAvailableM === undefined ? '—' : `${p.npshAvailableM.toFixed(2)} m`);
  } else if (id.startsWith('P-') || id === 'SUMP-01' || id === 'CLASS-01') {
    add('Q', qM3h === null ? '—' : `${qM3h.toFixed(2)} m³/h`);
    add('V', state.transport?.pipe1?.velocityMps === undefined ? '—' : `${state.transport.pipe1.velocityMps.toFixed(3)} m/s`);
    add('Re', t.reynoldsNumber === undefined ? '—' : t.reynoldsNumber.toFixed(0));
    add('ΔP', t.pressureDropPa === undefined ? '—' : `${(t.pressureDropPa / 1000).toFixed(2)} kPa`);
  } else if (id === 'MILL-01') {
    add('ρ pulpa', slurry.densityKgM3 === undefined ? '—' : `${slurry.densityKgM3.toFixed(1)} kg/m³`);
    add('Sólidos vol.', slurry.solidVolumeFraction === undefined ? '—' : `${(slurry.solidVolumeFraction * 100).toFixed(2)} %`);
    add('Modelo reológico', results.rheology?.model ?? '—');
  } else if (/^R-0[1-4]$/.test(id)) {
    add('Residencia', leaching.residenceTimeH === undefined ? '—' : `${leaching.residenceTimeH.toFixed(2)} h`);
    add('Conversión', leaching.conversion === undefined ? '—' : `${(leaching.conversion * 100).toFixed(2)} %`);
  } else if (['CIP-ADSORPTION', 'ELUTION-SKID', 'EW-CELLS', 'SMELTING-FURNACE'].includes(id)) {
    add('Recuperación global', recovery.overallRecovery === undefined ? '—' : `${(recovery.overallRecovery * 100).toFixed(2)} %`);
    add('Metal final', recovery.finalMetalKgH === undefined ? '—' : `${recovery.finalMetalKgH.toFixed(4)} kg/h`);
  }
  return rows;
}

function wireSceneFullscreen() {
  const sceneCard = document.querySelector('.scene-card');
  const controls = document.querySelector('.scene-controls');
  if (!sceneCard || !controls) return;
  const button = document.createElement('button');
  button.id = 'scene-fullscreen';
  button.type = 'button';
  button.className = 'scene-fullscreen-button';
  button.textContent = '⛶ Pantalla completa';
  const setPseudoFullscreen = (active) => {
    sceneCard.classList.toggle('is-pseudo-fullscreen', active);
    document.documentElement.classList.toggle('scene-pseudo-fullscreen-active', active);
    button.textContent = active ? '↙ Salir de pantalla completa' : '⛶ Pantalla completa';
    requestAnimationFrame(() => environmentHandle?.resize?.());
  };
  button.addEventListener('click', async () => {
    if (sceneCard.classList.contains('is-pseudo-fullscreen')) {
      setPseudoFullscreen(false);
      return;
    }
    try {
      if (document.fullscreenElement === sceneCard) await document.exitFullscreen?.();
      else if (sceneCard.requestFullscreen) await sceneCard.requestFullscreen();
      else setPseudoFullscreen(true);
    } catch {
      setPseudoFullscreen(true);
    }
  });
  controls.prepend(button);
  document.addEventListener('fullscreenchange', () => {
    const active = document.fullscreenElement === sceneCard;
    button.textContent = active ? '↙ Salir de pantalla completa' : '⛶ Pantalla completa';
    sceneCard.classList.toggle('is-fullscreen', active);
    requestAnimationFrame(() => environmentHandle?.resize?.());
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sceneCard.classList.contains('is-pseudo-fullscreen')) setPseudoFullscreen(false);
  });
}

function wireMobileWorkspaceJump() {
  document.querySelectorAll('[data-scroll-target]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.scrollTarget === 'parameters'
        ? document.querySelector('.sidebar')
        : document.querySelector('.content');
      target?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    });
  });
}

function render() {
  const state = getState();
  app.replaceChildren();
  const shell = document.createElement('div');
  shell.className = 'shell';
  shell.innerHTML = `
    <header class="topbar">
      <img class="brand-logo" src="/upn-logo.svg" alt="UPN · Universidad Privada del Norte">
      <div><p class="eyebrow">UPN · SIMULADOR ACADÉMICO</p><h1>PULPA LAB <span>V2</span></h1><small class="release-tag">${RELEASE_INFO.version} · ${RELEASE_INFO.name}</small></div>
      <div class="topbar-meta">MOTOR DE PARÁMETROS · SI</div><button id="theme-toggle" class="theme-toggle" type="button">PALETA</button>
    </header>
    <main class="workspace">
      <nav class="mobile-workspace-jump" aria-label="Navegación móvil del simulador"><button type="button" data-scroll-target="results">Resultados / 3D</button><button type="button" data-scroll-target="parameters">Parámetros</button></nav>
      <aside class="sidebar"><div id="theme-panel" class="theme-panel" hidden><div class="theme-panel-head"><strong>Paleta de interfaz</strong><button id="theme-reset" type="button">Restablecer UI</button></div><p>La apariencia se guarda en este navegador y no modifica la física.</p><div class="theme-grid"><label>Acento<input type="color" data-theme-key="accent"></label><label>Fondo<input type="color" data-theme-key="background"></label><label>Panel<input type="color" data-theme-key="panel"></label><label>Texto<input type="color" data-theme-key="text"></label></div><div class="theme-panel-head scene-theme-head"><strong>Paleta escena 3D</strong><button id="scene-palette-reset" type="button">Restablecer 3D</button></div><p>Roles visuales semánticos. No cambian densidad, rugosidad hidráulica ni ninguna propiedad física.</p><div class="theme-grid scene-theme-grid"><label>Terreno<input type="color" data-scene-role="terrain"></label><label>Caminos<input type="color" data-scene-role="road"></label><label>Concreto<input type="color" data-scene-role="concrete"></label><label>Acero<input type="color" data-scene-role="structuralSteel"></label><label>Proceso<input type="color" data-scene-role="processSteel"></label><label>Pipe acero<input type="color" data-scene-role="pipeSteel"></label><label>Pipe HDPE<input type="color" data-scene-role="pipeHdpe"></label><label>Seguridad<input type="color" data-scene-role="safetyYellow"></label><label>Mineral<input type="color" data-scene-role="mineral"></label><label>Vehículos<input type="color" data-scene-role="vehicleYellow"></label></div></div><div class="sidebar-heading"><span>PARÁMETROS</span><small>ENTRADA SI</small></div><div class="scenario-panel"><input id="scenario-name" type="text" value="Escenario" aria-label="Nombre del escenario"><select id="scenario-select" aria-label="Escenario guardado"></select><div class="scenario-controls" aria-label="Escenarios de simulación"><button id="scenario-save" type="button">Guardar / actualizar</button><button id="scenario-load" type="button">Cargar</button><button id="scenario-compare" type="button">Comparar</button><button id="scenario-delete" type="button">Eliminar</button><button id="scenario-export-json" type="button">Exportar JSON</button><button id="scenario-export-csv" type="button">Exportar CSV</button><button id="scenario-reset" type="button">Reset parámetros</button></div></div><p id="scenario-status" class="scenario-status" data-tone="muted">Los escenarios guardan entradas físicas; materiales/tema visual no se mezclan con la física.</p><section class="academic-case-panel" aria-labelledby="academic-case-title"><div class="academic-case-heading"><div><span>CASOS DE ESTUDIO</span><strong id="academic-case-title">Casos académicos</strong></div><small>V19</small></div><select id="academic-case-select" aria-label="Caso académico"><option value="">Seleccionar caso…</option></select><div class="academic-case-actions"><button id="academic-case-load" type="button">Cargar caso</button><button id="academic-case-present" type="button" disabled>Cargar + presentar</button></div><div id="academic-case-guide" class="academic-case-guide" hidden></div><p id="academic-case-status" class="academic-case-status" aria-live="polite">Valores académicos de referencia: revisar siempre el alcance del modelo.</p><small class="academic-global-scope">Sedimentación Durand: indicador orientativo histórico, no calibrado; d50/d80 se registran pero no alimentan esa correlación.</small><details id="academic-comparator" class="academic-comparator"><summary>Comparar dos casos</summary><div class="academic-comparator-body"><div class="academic-comparator-selects"><label>A<select id="academic-compare-left" aria-label="Caso A"></select></label><label>B<select id="academic-compare-right" aria-label="Caso B"></select></label></div><button id="academic-compare-run" type="button">Comparar A vs B</button><div id="academic-comparison-result" class="academic-comparison-result" hidden></div></div></details></section><div id="sections"></div><p id="validation-message" class="validation-message" aria-live="polite"></p></aside>
      <section class="content"><div class="content-heading"><div><p class="eyebrow">SIMULADOR UNIVERSITARIO</p><h2>Mec&aacute;nica de fluidos aplicada a transporte de pulpas</h2><p class="subtitle">Entradas f&iacute;sicas &rarr; modelo reol&oacute;gico/hidr&aacute;ulico &rarr; resultados &rarr; an&aacute;lisis. Sistema SI y alcance expl&iacute;cito por modelo.</p></div><span class="status-dot">● ESPERANDO PARÁMETROS</span></div><div class="scene-card"><div class="scene-card-head"><div><p class="eyebrow">GEMELO DIGITAL 3D</p><h3 id="view-title">Planta general</h3></div><div class="scene-controls"><div class="scene-toggles"><label class="label-toggle"><input id="labels-toggle" type="checkbox" checked><span>Mostrar etiquetas</span></label><label class="label-toggle"><input id="animations-toggle" type="checkbox" checked><span>Animaciones</span></label><label class="label-toggle geotech-toggle"><input id="geotech-toggle" type="checkbox"><span>Geotecnia / subsuelo</span></label></div><div class="inspection-toolbar" aria-label="Inspección interna"><label>Equipo<select id="inspection-target"><option value="">Seleccionar…</option></select></label><div class="inspection-stepper" role="group" aria-label="Recorrer circuito"><button id="inspection-prev" type="button" disabled>← Anterior</button><button id="inspection-next" type="button" disabled>Siguiente →</button></div><label>Modo<select id="inspection-mode" disabled><option value="normal">Normal</option><option value="transparent">Transparente</option><option value="cutaway">Corte</option><option value="interior">Interior</option></select></label></div><div id="camera-switcher" class="camera-switcher" role="group" aria-label="Vista de cámara"></div></div></div><div class="scene-viewport"><canvas id="environment-canvas" aria-label="Entorno exterior industrial V57/B64"></canvas><div id="scene-loading" class="scene-loading" role="status" aria-live="polite"><strong>Cargando Blender V57 · B64</strong><span>Preparando el entorno final, materiales y animaciones…</span></div><div id="presentation-controls" class="presentation-controls" data-active="false" aria-label="Modo presentación"><button id="presentation-toggle" class="presentation-toggle" type="button" aria-pressed="false">▶ Modo presentación</button><div id="presentation-player" class="presentation-player" hidden><button id="presentation-prev" type="button" aria-label="Parada anterior">←</button><button id="presentation-play" type="button" aria-label="Reproducir presentación" aria-pressed="false">▶</button><button id="presentation-next" type="button" aria-label="Siguiente parada">→</button><span id="presentation-progress" aria-live="polite">01 / 19</span></div></div><aside id="inspection-guide" class="inspection-guide" hidden aria-live="polite" aria-label="Ficha t&eacute;cnica del equipo seleccionado"></aside><aside id="geotech-legend" class="geotech-legend" hidden aria-label="Leyenda geotécnica"><strong>SUBSUELO CONCEPTUAL</strong><span><i data-geotech-color="natural"></i>Natural: suelo / roca</span><span><i data-geotech-color="engineered"></i>Construido: relleno / cimentación</span><span><i data-geotech-color="water"></i>Hidrogeología conceptual</span><small>No representa campaña geotécnica ni modelo hidrogeológico calibrado.</small></aside><p id="scene-error" class="scene-error" hidden></p></div></div><section class="hydraulic-summary" aria-labelledby="hydraulic-summary-title"><div class="technical-section-head"><div><p class="eyebrow">RESULTADOS PRINCIPALES</p><h3 id="hydraulic-summary-title">Estado hidr&aacute;ulico del circuito</h3></div><small>Valores del escenario activo</small></div><div class="kpi-grid"><article><span>CAUDAL Q</span><strong id="kpi-flow">&mdash;</strong><small>caudal volum&eacute;trico</small></article><article><span>VELOCIDAD V</span><strong id="kpi-velocity">&mdash;</strong><small>velocidad media</small></article><article><span>REYNOLDS Re</span><strong id="kpi-reynolds">&mdash;</strong><small id="kpi-regime-note">r&eacute;gimen pendiente</small></article><article><span>FACTOR DARCY f</span><strong id="kpi-friction-factor">&mdash;</strong><small>adimensional</small></article><article><span>&Delta;P TOTAL</span><strong id="kpi-dp">&mdash;</strong><small id="kpi-dp-note">requiere modelo aplicable</small></article><article><span>CARGA H</span><strong id="kpi-head">&mdash;</strong><small>m de fluido</small></article><article><span>POTENCIA P</span><strong id="kpi-power">&mdash;</strong><small>potencia el&eacute;ctrica</small></article><article><span>NPSH DISPONIBLE</span><strong id="kpi-npsh">&mdash;</strong><small id="kpi-npsh-note">requiere curva de bomba</small></article></div></section><div class="result-panel"><div class="result-panel-heading"><div><p class="eyebrow">VALIDACI&Oacute;N Y RESULTADOS</p><h3>Reolog&iacute;a &rarr; hidr&aacute;ulica &rarr; bombeo &rarr; proceso</h3></div></div><div class="validity-strip" aria-label="Estado de aplicabilidad"><span id="validity-hydraulic" class="validity-badge" data-state="pending">Hidr&aacute;ulica &middot; pendiente</span><span id="validity-rheology" class="validity-badge" data-state="pending">Reolog&iacute;a &middot; pendiente</span><span id="validity-pump" class="validity-badge" data-state="pending">Bomba &middot; pendiente</span><span id="validity-process" class="validity-badge" data-state="pending">Proceso &middot; pendiente</span></div><section id="engineering-comparison" class="engineering-comparison" hidden></section><div class="result-metrics"><div><span>Modelo activo</span><strong id="result-model">Pendiente de par&aacute;metros</strong></div><div><span>R&eacute;gimen</span><strong id="result-regime">&mdash;</strong></div><div><span>Densidad de pulpa</span><strong id="result-density">&mdash;</strong></div><div><span>S&oacute;lidos vol.</span><strong id="result-phi">&mdash;</strong></div><div><span>Esfuerzo de pared</span><strong id="result-wall-stress">&mdash;</strong></div><div><span>Gradiente &Delta;P/L</span><strong id="result-pressure-gradient">&mdash;</strong></div><div><span>P&eacute;rdidas locales</span><strong id="result-local-loss">&mdash;</strong></div><div><span>Componente est&aacute;tica</span><strong id="result-static">&mdash;</strong></div><div><span>Energ&iacute;a anual</span><strong id="result-energy">&mdash;</strong></div><div><span>Costo anual</span><strong id="result-cost">&mdash;</strong></div><div><span>Residencia lixiviaci&oacute;n</span><strong id="result-residence">&mdash;</strong></div><div><span>Recuperaci&oacute;n global</span><strong id="result-recovery">&mdash;</strong></div></div><details class="equations-panel"><summary>Ecuaciones / Supuestos</summary><div class="equations-grid"><article><span>Continuidad</span><strong>Q = V&middot;A</strong><small>A = &pi;D<sup>2</sup>/4</small></article><article><span>Reynolds</span><strong>Re = &rho;VD/&mu;</strong><small>Newtoniano; no newtoniano usa Reynolds generalizado.</small></article><article><span>Darcy&ndash;Weisbach</span><strong>&Delta;P<sub>f</sub> = f(L/D)(&rho;V<sup>2</sup>/2)</strong><small>Factor Darcy seg&uacute;n r&eacute;gimen y rugosidad.</small></article><article><span>P&eacute;rdidas locales</span><strong>&Delta;P<sub>m</sub> = &Sigma;K(&rho;V<sup>2</sup>/2)</strong><small>Accesorios expl&iacute;citos + K adicional.</small></article><article><span>Componente est&aacute;tica</span><strong>&Delta;P<sub>z</sub> = &rho;g&Delta;z</strong><small>&Delta;z positivo cuando descarga est&aacute; m&aacute;s alta.</small></article><article><span>Carga total</span><strong>H = &Delta;P/(&rho;g)</strong><small>Conversi&oacute;n de presi&oacute;n requerida a metros de fluido.</small></article><article><span>Potencia</span><strong>P<sub>e</sub> = Q&Delta;P/(&eta;<sub>p</sub>&eta;<sub>m</sub>)</strong><small>Eficiencias de bomba y motor expl&iacute;citas.</small></article><article><span>NPSH disponible</span><strong>NPSH<sub>A</sub> = (P<sub>a</sub>-P<sub>v</sub>)/(&rho;g)+z<sub>s</sub>-h<sub>fs</sub></strong><small>Comparaci&oacute;n de margen; no predice cavitaci&oacute;n.</small></article></div><p class="equation-scope">Modelo activo: <strong id="equation-active-model">pendiente</strong>. Los resultados fuera del dominio implementado se identifican expl&iacute;citamente como estimaci&oacute;n educativa o no calculable.</p></details><div class="chart-grid"><div id="rheology-chart" class="result-chart"></div><div id="pressure-chart" class="result-chart"></div></div><p id="model-status" class="model-status">Sin advertencias de aplicabilidad.</p><p class="result-note">El bloque hidr&aacute;ulico/reol&oacute;gico es el n&uacute;cleo de Mec&aacute;nica de Fluidos. Lixiviaci&oacute;n, recuperaci&oacute;n y fundici&oacute;n permanecen como contexto del proceso minero y se reportan por separado.</p></div></section>
    </main>
  </div>`;
  app.append(shell);
  installWorkspaceTabs(shell);
  renderParameterSections();
  const cameraSwitcher = shell.querySelector('#camera-switcher');
  CAMERA_PRESET_ORDER.forEach((cameraId) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.camera = cameraId;
    button.textContent = CAMERA_PRESET_LABELS[cameraId];
    button.classList.toggle('active', cameraId === 'general');
    cameraSwitcher.append(button);
  });
  wireThemeEditor();
  wireScenarioControls();
  wireAcademicCaseControls();
  wireAcademicLabControls();
  compactScenarioPanel();
  wireSceneFullscreen();
  wireMobileWorkspaceJump();
  setScenarioStatus('Caso de ejemplo precargado. Modifica los valores o guarda tu propio escenario.', 'success');
  renderResultsPanel(getResults(), getState());
}

render();
const unsubscribeResultsRender = subscribeResults((results) => {
  renderResultsPanel(results, getState());
  if (activeComparisonScenarioId) {
    const scenario = loadNamedScenario(activeComparisonScenarioId);
    if (scenario) renderScenarioComparison(scenario);
    else activeComparisonScenarioId = null;
  }
  if (activeWorkspaceTab !== 'circuit') renderScientificWorkspace(activeWorkspaceTab);
});

async function initializeEnvironment(canvas) {
  try {
  const { createBaseEnvironment } = await import('./babylon/runtime/baseEnvironment.js');
    const environment = createBaseEnvironment({ canvas });
    environmentHandle = environment;
    environment.setScenePalette(paletteHexToNumbers(activeScenePalette));
    const applyProcessMetrics = (results) => environment.setProcessMetrics({
      flowRateM3s: results.transport?.flowRateM3s ?? 0,
      pressurePa: results.transport?.requiredPressurePa ?? 0,
    });
    applyProcessMetrics(getResults());
    unsubscribeProcessMetrics = subscribeResults(applyProcessMetrics);
    const labelsToggle = document.querySelector('#labels-toggle');
    labelsToggle?.addEventListener('change', () => environment.setLabelsVisible(labelsToggle.checked));
    const animationsToggle = document.querySelector('#animations-toggle');
    animationsToggle?.addEventListener('change', () => environment.setAnimationsEnabled(animationsToggle.checked));
    const geotechToggle = document.querySelector('#geotech-toggle');
    const persistedGeotech = (() => {
      try { return sessionStorage.getItem('pulpa-lab-geotech-visible') === 'true'; } catch { return false; }
    })();
    const geotechLegend = document.querySelector('#geotech-legend');
    if (geotechToggle) geotechToggle.checked = persistedGeotech;
    if (geotechLegend) geotechLegend.hidden = !persistedGeotech;
    environment.setGeotechnicsVisible(persistedGeotech);
    geotechToggle?.addEventListener('change', () => {
      environment.setGeotechnicsVisible(geotechToggle.checked);
      if (geotechLegend) geotechLegend.hidden = !geotechToggle.checked;
      try { sessionStorage.setItem('pulpa-lab-geotech-visible', String(geotechToggle.checked)); } catch { /* session storage may be unavailable */ }
    });

    const sceneLoading = document.querySelector('#scene-loading');
    const siteVisual = environment.v57SiteVisual;
    if (siteVisual?.ready) {
      const syncSiteVisualUi = async () => {
        await siteVisual.ready;
        const v57Ready = siteVisual.loaded;
        if (sceneLoading) {
          sceneLoading.querySelector('strong').textContent = v57Ready
            ? 'Blender V57 · B64 listo'
            : 'Error cargando Blender V57 · B64';
          sceneLoading.querySelector('span').textContent = v57Ready
            ? 'Entorno final operativo cargado correctamente.'
            : 'No se activará ningún entorno antiguo. Recarga la página para reintentar.';
          if (v57Ready) window.setTimeout(() => sceneLoading.classList.add('is-ready'), 120);
        }
        if (geotechToggle) {
          geotechToggle.disabled = v57Ready;
          geotechToggle.checked = v57Ready ? false : persistedGeotech;
          if (v57Ready) environment.setGeotechnicsVisible(false);
        }
        if (geotechLegend) geotechLegend.hidden = v57Ready || !persistedGeotech;
      };
      const loadCompleted = await Promise.race([
        syncSiteVisualUi().then(() => true),
        new Promise((resolve) => window.setTimeout(() => resolve(false), 12000)),
      ]);
      if (!loadCompleted && sceneLoading) {
        sceneLoading.querySelector('strong').textContent = 'Cargando Blender V57 · B64';
        sceneLoading.querySelector('span').textContent = 'El entorno final continúa cargando; no se mostrará una versión anterior.';
      }
    } else {
      if (sceneLoading) {
        sceneLoading.querySelector('strong').textContent = 'Blender V57 · B64 no disponible';
        sceneLoading.querySelector('span').textContent = 'No existe fallback a versiones anteriores.';
      }
    }

    const inspectionTarget = document.querySelector('#inspection-target');
    const inspectionMode = document.querySelector('#inspection-mode');
    const inspectionPrev = document.querySelector('#inspection-prev');
    const inspectionNext = document.querySelector('#inspection-next');
    const inspectionGuide = document.querySelector('#inspection-guide');
    const inspectionTargets = environment.getInspectionTargets();
    const presentationControls = document.querySelector('#presentation-controls');
    const presentationToggle = document.querySelector('#presentation-toggle');
    const presentationPlayer = document.querySelector('#presentation-player');
    const presentationPrev = document.querySelector('#presentation-prev');
    const presentationPlay = document.querySelector('#presentation-play');
    const presentationNext = document.querySelector('#presentation-next');
    const presentationProgress = document.querySelector('#presentation-progress');
    const presentationStops = PRESENTATION_STOP_IDS
      .map((id) => inspectionTargets.find((item) => item.id === id))
      .filter(Boolean);
    const presentationDelayMs = 7500;
    let presentationActive = false;
    let presentationPlaying = false;
    let presentationIndex = 0;
    let presentationTimer = null;
    let presentationSelecting = false;
    let presentationPreviousLabelsVisible = null;
    inspectionTargets.forEach(({ id, label }, index) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = `${String(index + 1).padStart(2, '0')} · ${label}`;
      inspectionTarget?.append(option);
    });
    const updateInspectionStepper = () => {
      const index = inspectionTargets.findIndex((item) => item.id === inspectionTarget?.value);
      if (inspectionPrev) inspectionPrev.disabled = index <= 0;
      if (inspectionNext) inspectionNext.disabled = index < 0 || index >= inspectionTargets.length - 1;
    };
    const clearPresentationTimer = () => {
      if (presentationTimer !== null) window.clearTimeout(presentationTimer);
      presentationTimer = null;
    };
    const updatePresentationControls = () => {
      const total = presentationStops.length;
      if (presentationControls) presentationControls.dataset.active = String(presentationActive);
      if (presentationToggle) {
        presentationToggle.setAttribute('aria-pressed', String(presentationActive));
        presentationToggle.textContent = presentationActive ? '× Salir presentación' : '▶ Modo presentación';
      }
      if (presentationPlayer) presentationPlayer.hidden = !presentationActive;
      if (presentationPrev) presentationPrev.disabled = !presentationActive || presentationIndex <= 0;
      if (presentationNext) presentationNext.disabled = !presentationActive || presentationIndex >= total - 1;
      if (presentationPlay) {
        presentationPlay.disabled = !presentationActive || total === 0;
        presentationPlay.setAttribute('aria-pressed', String(presentationPlaying));
        presentationPlay.setAttribute('aria-label', presentationPlaying ? 'Pausar presentación' : 'Reproducir presentación');
        presentationPlay.textContent = presentationPlaying ? '❚❚' : '▶';
      }
      if (presentationProgress) {
        presentationProgress.textContent = total
          ? String(presentationIndex + 1).padStart(2, '0') + ' / ' + String(total).padStart(2, '0')
          : '00 / 00';
      }
    };
    const schedulePresentationAdvance = () => {
      clearPresentationTimer();
      if (!presentationActive || !presentationPlaying || presentationStops.length === 0) return;
      if (presentationIndex >= presentationStops.length - 1) {
        presentationPlaying = false;
        updatePresentationControls();
        return;
      }
      presentationTimer = window.setTimeout(() => {
        presentationIndex += 1;
        const stop = presentationStops[presentationIndex];
        if (inspectionTarget && stop) {
          presentationSelecting = true;
          inspectionTarget.value = stop.id;
          inspectionTarget.dispatchEvent(new Event('change'));
          presentationSelecting = false;
        }
        updatePresentationControls();
        schedulePresentationAdvance();
      }, presentationDelayMs);
    };
    const setPresentationPlaying = (value) => {
      if (!presentationActive) return;
      const next = Boolean(value);
      if (next && presentationStops.length && presentationIndex >= presentationStops.length - 1) {
        presentationIndex = 0;
        const first = presentationStops[0];
        if (inspectionTarget && first) {
          presentationSelecting = true;
          inspectionTarget.value = first.id;
          inspectionTarget.dispatchEvent(new Event('change'));
          presentationSelecting = false;
        }
      }
      presentationPlaying = next;
      updatePresentationControls();
      schedulePresentationAdvance();
    };
    const selectPresentationStop = (index) => {
      if (!presentationStops.length) return;
      presentationIndex = Math.max(0, Math.min(index, presentationStops.length - 1));
      const stop = presentationStops[presentationIndex];
      if (inspectionTarget && stop) {
        presentationSelecting = true;
        inspectionTarget.value = stop.id;
        inspectionTarget.dispatchEvent(new Event('change'));
        presentationSelecting = false;
      }
      updatePresentationControls();
      if (presentationPlaying) schedulePresentationAdvance();
    };
    const setPresentationActive = (value) => {
      const wasActive = presentationActive;
      const nextActive = Boolean(value) && presentationStops.length > 0;
      if (nextActive && !wasActive) {
        presentationPreviousLabelsVisible = labelsToggle?.checked ?? environment.labelsVisible;
        environment.setPresentationMode?.(true);
      }
      presentationActive = nextActive;
      clearPresentationTimer();
      if (!presentationActive) {
        presentationPlaying = false;
        environment.setPresentationMode?.(false);
        if (wasActive && presentationPreviousLabelsVisible !== null) {
          if (labelsToggle) labelsToggle.checked = presentationPreviousLabelsVisible;
          environment.setLabelsVisible(presentationPreviousLabelsVisible);
        }
        presentationPreviousLabelsVisible = null;
        updatePresentationControls();
        renderInspectionGuide();
        return;
      }
      const selectedIndex = presentationStops.findIndex((item) => item.id === inspectionTarget?.value);
      presentationIndex = selectedIndex >= 0 ? selectedIndex : 0;
      presentationPlaying = false;
      updatePresentationControls();
      selectPresentationStop(presentationIndex);
    };
    startPresentationTour = (startId = null) => {
      setPresentationActive(true);
      const requestedIndex = startId
        ? presentationStops.findIndex((item) => item.id === startId)
        : -1;
      if (requestedIndex >= 0) selectPresentationStop(requestedIndex);
    };
    const academicPresentButton = document.querySelector('#academic-case-present');
    if (academicPresentButton) academicPresentButton.disabled = false;
    const renderInspectionGuide = () => {
      const id = inspectionTarget?.value || '';
      const guide = getInspectionGuideEntry(id);
      const target = inspectionTargets.find((item) => item.id === id);
      const presentationRank = presentationStops.findIndex((item) => item.id === id);
      const presentationView = presentationActive && presentationRank >= 0;
      if (environment.activeCamera !== 'inspection' && !presentationView) {
        if (inspectionGuide) {
          inspectionGuide.hidden = true;
          inspectionGuide.classList.remove('presentation-summary');
          inspectionGuide.replaceChildren();
        }
        return;
      }
      if (!inspectionGuide || !guide || !target) {
        if (inspectionGuide) {
          inspectionGuide.hidden = true;
          inspectionGuide.classList.remove('presentation-summary');
          inspectionGuide.replaceChildren();
        }
        return;
      }
      inspectionGuide.classList.toggle('presentation-summary', presentationView);
      if (presentationView) {
        inspectionGuide.innerHTML =
          '<header><span>PRESENTACIÓN · '
          + String(presentationRank + 1).padStart(2, '0')
          + '/'
          + String(presentationStops.length).padStart(2, '0')
          + '</span><strong>'
          + target.label
          + '</strong></header>'
          + '<p class="inspection-guide-purpose"><b>Qué hace:</b> '
          + guide.purpose
          + '</p>'
          + '<div class="presentation-flow"><span><b>Entrada</b>'
          + guide.input
          + '</span><i>→</i><span><b>Salida</b>'
          + guide.output
          + '</span></div>'
          + '<p class="presentation-variable"><b>Variable clave:</b> '
          + guide.keyVariable
          + '</p>';
        inspectionGuide.hidden = false;
        return;
      }
      const previous = inspectionTargets.find((item) => item.id === target.previousId);
      const next = inspectionTargets.find((item) => item.id === target.nextId);
      const stage = getInspectionStage(id);
      const relatedResult = getInspectionRelatedResult(id);
      const liveMetrics = inspectionMetricRows(id, getState(), getResults());
      const liveMetricsHtml = liveMetrics.length
        ? `<section class="inspection-live-metrics" aria-label="Variables del equipo">${liveMetrics.map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join('')}</section>`
        : '';
      const componentHotspots = getInspectionComponentHotspots(id);
      const componentHotspotsHtml = componentHotspots.length
        ? `<section class="inspection-component-hotspots" aria-label="Componentes clave de ${target.label}">
            <h4>COMPONENTES CLAVE</h4>
            ${componentHotspots.map((item) => `
              <article>
                <strong>${item.component}</strong>
                <span>${item.function}</span>
                <small>${item.processLink}</small>
              </article>
            `).join('')}
          </section>`
        : '';
      const proxyNote = target.semanticOnly
        ? '<p class="inspection-proxy-note">Esta etapa se muestra como referencia semántica V50; no existe una malla dedicada para Corte/Interior.</p>'
        : target.proxySemantics
          ? `<p class="inspection-proxy-note">Referencia visual V50: ${target.proxySemantics}. La geometría representa el corredor físico disponible, no una transferencia de carbón modelada por separado.</p>`
          : '';
      inspectionGuide.innerHTML = `
        <header><span>FICHA TÉCNICA · ${id}</span><strong>${target.label}</strong></header>
        <p class="inspection-guide-purpose"><b>Función:</b> ${guide.purpose}</p>
        <dl>
          <div><dt>Etapa</dt><dd>${stage}</dd></div>
          <div><dt>Variable / resultado</dt><dd>${relatedResult}</dd></div>
          <div><dt>Aguas arriba</dt><dd>${previous?.label ?? 'Inicio del recorrido'}</dd></div>
          <div><dt>Aguas abajo</dt><dd>${next?.label ?? 'Fin del recorrido'}</dd></div>
          <div><dt>Entrada de proceso</dt><dd>${guide.input}</dd></div>
          <div><dt>Salida de proceso</dt><dd>${guide.output}</dd></div>
          <div><dt>Variable clave</dt><dd>${guide.keyVariable}</dd></div>
          <div class="inspection-guide-impact"><dt>Alcance del modelo</dt><dd>${guide.calculationImpact}</dd></div>
        </dl>
        ${liveMetricsHtml}
        ${componentHotspotsHtml}
        ${proxyNote}
        <div class="inspection-context-legend" aria-label="Leyenda de contexto del circuito">
          <span><i data-context="upstream"></i>Anterior</span>
          <span><i data-context="selected"></i>Seleccionado</span>
          <span><i data-context="downstream"></i>Siguiente</span>
        </div>
        <footer><span>Conexión anterior: ${previous?.label ?? 'Inicio del recorrido'}</span><span>Conexión siguiente: ${next?.label ?? 'Fin del recorrido'}</span></footer>
      `;
      inspectionGuide.hidden = false;
    };
    inspectionTarget?.addEventListener('change', () => {
      if (presentationActive && !presentationSelecting) {
        const rank = presentationStops.findIndex((item) => item.id === inspectionTarget.value);
        if (rank >= 0) {
          presentationIndex = rank;
          presentationPlaying = false;
          clearPresentationTimer();
          updatePresentationControls();
        } else {
          setPresentationActive(false);
        }
      }
      environment.setInspectionTarget(inspectionTarget.value || null);
      if (inspectionMode) {
        const selectedInspection = inspectionTargets.find((item) => item.id === inspectionTarget.value);
        inspectionMode.disabled = !inspectionTarget.value || selectedInspection?.supportsModes === false;
        inspectionMode.value = 'normal';
      }
      updateInspectionStepper();
      renderInspectionGuide();
      if (inspectionTarget.value && environment.activeCamera !== 'inspection') {
        environment.setCamera('inspection');
        document.querySelector('#view-title').textContent = CAMERA_PRESET_LABELS.inspection;
        document.querySelectorAll('[data-camera]').forEach((item) => item.classList.toggle('active', item.dataset.camera === 'inspection'));
      }
    });
    const stepInspection = (delta) => {
      const index = inspectionTargets.findIndex((item) => item.id === inspectionTarget?.value);
      const nextIndex = index < 0 ? (delta > 0 ? 0 : inspectionTargets.length - 1) : index + delta;
      if (!inspectionTarget || nextIndex < 0 || nextIndex >= inspectionTargets.length) return;
      inspectionTarget.value = inspectionTargets[nextIndex].id;
      inspectionTarget.dispatchEvent(new Event('change'));
    };
    inspectionPrev?.addEventListener('click', () => stepInspection(-1));
    inspectionNext?.addEventListener('click', () => stepInspection(1));
    updateInspectionStepper();
    renderInspectionGuide();
    inspectionMode?.addEventListener('change', () => environment.setInspectionMode(inspectionMode.value));
    presentationToggle?.addEventListener('click', () => setPresentationActive(!presentationActive));
    presentationPrev?.addEventListener('click', () => selectPresentationStop(presentationIndex - 1));
    presentationNext?.addEventListener('click', () => selectPresentationStop(presentationIndex + 1));
    presentationPlay?.addEventListener('click', () => setPresentationPlaying(!presentationPlaying));
    updatePresentationControls();

    document.querySelectorAll('[data-camera]').forEach((button) => {
      button.addEventListener('click', () => {
        if (presentationActive && button.dataset.camera !== 'inspection') setPresentationActive(false);
        else if (presentationActive && presentationPlaying) setPresentationPlaying(false);
        environment.setCamera(button.dataset.camera);
        document.querySelector('#view-title').textContent = CAMERA_PRESET_LABELS[button.dataset.camera];
        document.querySelectorAll('[data-camera]').forEach((item) => item.classList.toggle('active', item === button));
        renderInspectionGuide();
      });
    });
  } catch (error) {
    const sceneError = document.querySelector('#scene-error');
    const sceneLoading = document.querySelector('#scene-loading');
    if (sceneLoading) {
      sceneLoading.querySelector('strong').textContent = 'No se pudo cargar el entorno 3D';
      sceneLoading.querySelector('span').textContent = 'Revisa la conexión y vuelve a cargar la página.';
      sceneLoading.classList.remove('is-ready');
    }
    sceneError.hidden = false;
    sceneError.textContent = 'No se pudo inicializar el entorno 3D.';
    console.error(error);
  }
}

const canvas = document.querySelector('#environment-canvas');
if (canvas) initializeEnvironment(canvas);

window.addEventListener('beforeunload', () => {
  unsubscribeResultsRender?.();
  unsubscribeProcessMetrics?.();
  environmentHandle?.dispose?.();
});
