import { compareScenarios } from './scenarios.js';

// A saved library selection is NOT evidence that those values are currently
// loaded or that changes to active inputs were saved. Reports must never be
// published with the name of unrelated/stale stored inputs.
export function resolveMemoryScenarioProvenance(selectedScenario, activeState) {
  if (!selectedScenario) {
    return {
      scenarioName: 'Escenario actual',
      notice: '',
      matchesSaved: false,
    };
  }
  const matchesSaved = compareScenarios(selectedScenario, activeState).length === 0;
  if (matchesSaved) {
    return {
      scenarioName: selectedScenario.name,
      notice: 'Los parámetros de esta memoria coinciden con el escenario guardado seleccionado.',
      matchesSaved: true,
    };
  }
  return {
    scenarioName: 'Escenario actual · borrador no guardado',
    notice: 'Los valores calculados NO coinciden con el escenario guardado seleccionado. El informe contiene únicamente el estado activo, no el contenido de la biblioteca.',
    matchesSaved: false,
  };
}
