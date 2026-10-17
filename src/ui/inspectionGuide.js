function entry(purpose, input, output, keyVariable, calculationImpact) {
  return Object.freeze({ purpose, input, output, keyVariable, calculationImpact });
}

function hotspot(component, functionText, processLink) {
  return Object.freeze({ component, function: functionText, processLink });
}

const visualTransferImpact = 'Representa la continuidad del proceso en 3D; no añade una ecuación hidráulica independiente ni altera los resultados de cálculo.';
const conveyorImpact = 'Representa transporte de mineral y continuidad de planta; velocidad de faja y capacidad no forman parte del solver reológico/hidráulico actual.';
const mobileImpact = 'Aporta contexto operacional y entrenamiento visual; su movimiento no modifica reología, hidráulica ni recuperación.';

export const INSPECTION_GUIDE = Object.freeze({
  'EXCAVATOR-01': entry(
    'Carga mineral fragmentado desde el frente de mina hacia el camión.',
    'Mineral tronado en banco.',
    'Camión cargado hacia ROM.',
    'Ciclo de carguío · contexto operativo',
    mobileImpact,
  ),
  'TRUCK-01': entry(
    'Transporta mineral ROM desde mina hasta la recepción de planta.',
    'Mineral cargado por excavadora.',
    'Mineral descargado en tolva ROM.',
    'Estado de carga, ruta y descarga',
    mobileImpact,
  ),
  'ROM-HOPPER': entry(
    'Recibe mineral ROM y amortigua la alimentación al chancado.',
    'Descarga de camiones.',
    'Mineral hacia el chute y apron feeder.',
    'Inventario/alimentación conceptual',
    'La tolva es contexto de proceso; el modelo actual no resuelve dinámica de nivel ni capacidad de almacenamiento.',
  ),
  'ROM-TO-FEEDER-CHUTE': entry(
    'Guía por gravedad el mineral desde la tolva al alimentador.',
    'Mineral descargado desde ROM-HOPPER.',
    'Mineral sobre APRON-FEEDER.',
    'Continuidad de transferencia',
    visualTransferImpact,
  ),
  'APRON-FEEDER': entry(
    'Dosifica mineral grueso hacia la chancadora primaria.',
    'Mineral desde tolva ROM.',
    'Alimentación controlada hacia CV-01.',
    'Velocidad/cadencia de alimentación visual',
    'Su animación representa dosificación; el simulador no calcula potencia ni capacidad del apron feeder.',
  ),
  'CV-01-FEEDER-TO-CRUSHER': entry(
    'Transporta mineral desde el feeder hasta chancado primario.',
    'Mineral alimentado por APRON-FEEDER.',
    'Mineral a PRIMARY-CRUSHER.',
    'Transporte de mineral',
    conveyorImpact,
  ),
  'PRIMARY-CRUSHER': entry(
    'Reduce el tamaño del mineral para preparar almacenamiento y molienda.',
    'Mineral ROM alimentado por CV-01.',
    'Mineral chancado hacia CV-02.',
    'Reducción de tamaño · contexto',
    'La chancadora se anima mecánicamente, pero PULPA LAB no predice P80, potencia de chancado ni distribución granulométrica.',
  ),
  'CV-02-CRUSHER-TO-STOCKPILE': entry(
    'Transporta mineral chancado hacia el stockpile.',
    'Descarga de PRIMARY-CRUSHER.',
    'Mineral almacenado en STOCKPILE-RECLAIM.',
    'Transporte de mineral',
    conveyorImpact,
  ),
  'STOCKPILE-RECLAIM': entry(
    'Proporciona almacenamiento intermedio y continuidad de alimentación a molienda.',
    'Mineral chancado desde CV-02.',
    'Mineral reclamado hacia loader/CV-03.',
    'Inventario y homogenización conceptual',
    'Se usa como contexto operativo; no se resuelve inventario transiente ni blending en el cálculo central.',
  ),
  'LOADER-01': entry(
    'Apoya el reclaim y manejo de mineral alrededor del stockpile.',
    'Mineral en stockpile.',
    'Mineral disponible para CV-03.',
    'Ciclo de carguío/reclaim',
    mobileImpact,
  ),
  'CV-03-STOCKPILE-TO-GRINDING': entry(
    'Entrega mineral reclamado al área de molienda.',
    'Mineral desde stockpile.',
    'Alimentación a MILL-01.',
    'Transporte de mineral',
    conveyorImpact,
  ),
  'MILL-01': entry(
    'Representa molienda y preparación de la pulpa que entra al circuito húmedo.',
    'Mineral + fase líquida de proceso.',
    'Pulpa hacia sump y clasificación.',
    'Concentración de sólidos en masa',
    'El % de sólidos ingresado modifica densidad y comportamiento reológico de la pulpa. El modelo no predice P80 ni energía específica de molienda.',
  ),
  'P-MILL-TO-SUMP': entry(
    'Conecta la descarga del molino con el sump.',
    'Pulpa desde MILL-01.',
    'Pulpa hacia SUMP-01.',
    'Topología y dirección de flujo',
    visualTransferImpact,
  ),
  'SUMP-01': entry(
    'Amortigua el flujo de pulpa antes del bombeo a clasificación.',
    'Pulpa desde molienda.',
    'Pulpa hacia la bomba de clasificación.',
    'Caudal de descarga / balance del tanque',
    'El caudal de proceso alimenta el balance y el transporte; el modelo no resuelve un nivel transiente del sump.',
  ),
  'P-SUMP-TO-PUMP': entry(
    'Conecta el sump con la succión de la bomba.',
    'Pulpa desde SUMP-01.',
    'Pulpa hacia SLURRY-PUMP-01.',
    'Topología y dirección de flujo',
    visualTransferImpact,
  ),
  'SLURRY-PUMP-01': entry(
    'Entrega energía a la pulpa para enviarla a clasificación.',
    'Pulpa desde sump.',
    'Pulpa presurizada hacia ciclones.',
    'Presión requerida · eficiencia de bomba/motor',
    'Relaciona la demanda hidráulica del caso con carga, potencia y energía; la geometría 3D no cambia la curva física ingresada.',
  ),
  'P-PUMP-TO-CYCLONES': entry(
    'Conduce pulpa desde la bomba al manifold de ciclones.',
    'Pulpa presurizada.',
    'Alimentación a CLASS-01.',
    'Topología y dirección de flujo',
    visualTransferImpact,
  ),
  'CLASS-01': entry(
    'Representa la clasificación en ciclones y la separación entre overflow y underflow.',
    'Pulpa desde la bomba.',
    'Overflow hacia lixiviación y underflow de retorno.',
    'Partición/recirculación conceptual',
    'La recirculación se muestra en 3D; el modelo actual no resuelve curva de partición, d50 ni eficiencia de clasificación.',
  ),
  'P-CYCLONE-UNDERFLOW-RETURN': entry(
    'Muestra el retorno del underflow al circuito de molienda.',
    'Fracción gruesa de CLASS-01.',
    'Retorno hacia molienda.',
    'Recirculación de sólidos',
    visualTransferImpact,
  ),
  'P-CLASSIFICATION-TO-LEACH': entry(
    'Lleva el overflow clasificado hacia lixiviación.',
    'Pulpa clasificada.',
    'Alimentación a R-01.',
    'Topología y dirección de flujo',
    visualTransferImpact,
  ),
  'R-01': entry(
    'Primer reactor CSTR de lixiviación del tren.',
    'Pulpa clasificada + reactivos definidos por el caso.',
    'Pulpa parcialmente lixiviada hacia R-02.',
    'k · volumen útil · caudal',
    'Volumen y caudal determinan residencia; k y residencia alimentan la conversión del modelo de lixiviación.',
  ),
  'P-LEACH-R01-R02': entry(
    'Tramo hidráulico representativo entre los primeros reactores de lixiviación.',
    'Pulpa desde R-01.',
    'Pulpa hacia R-02.',
    'D · L · rugosidad · velocidad · Δz · K',
    'Este es el Pipe 1 ligado al cálculo hidráulico: interviene en Reynolds/régimen, pérdidas distribuidas y locales, componente estática, presión requerida y potencia.',
  ),
  'R-02': entry(
    'Segundo reactor CSTR; continúa la lixiviación en serie.',
    'Pulpa desde R-01.',
    'Pulpa hacia R-03.',
    'k · volumen útil · caudal',
    'Aporta residencia y conversión acumulada del tren CSTR bajo la cinética explícita del caso.',
  ),
  'P-LEACH-R02-R03': entry(
    'Conecta R-02 con R-03 dentro del tren de lixiviación.',
    'Pulpa desde R-02.',
    'Pulpa hacia R-03.',
    'Topología y dirección de flujo',
    'Se representa para continuidad de proceso; no es un segundo Pipe 1 ni introduce parámetros hidráulicos independientes.',
  ),
  'R-03': entry(
    'Tercer reactor CSTR del tren de lixiviación.',
    'Pulpa desde R-02.',
    'Pulpa hacia R-04.',
    'k · volumen útil · caudal',
    'Aporta residencia y conversión acumulada con el mismo alcance cinético validado del tren.',
  ),
  'P-LEACH-R03-R04': entry(
    'Conecta R-03 con el reactor final.',
    'Pulpa desde R-03.',
    'Pulpa hacia R-04.',
    'Topología y dirección de flujo',
    'Mantiene la secuencia 3D; no agrega un cálculo hidráulico individual separado.',
  ),
  'R-04': entry(
    'Reactor final del tren de lixiviación antes de recuperación.',
    'Pulpa desde R-03.',
    'Pulpa lixiviada hacia bombeo/recuperación.',
    'k · volumen útil · caudal',
    'Completa la residencia/conversión del tren CSTR que alimenta el balance de recuperación posterior.',
  ),
  'P-LEACHING-TO-PUMP-01': entry(
    'Conduce la pulpa lixiviada hacia la bomba de recuperación.',
    'Pulpa desde R-04.',
    'Pulpa hacia PUMP-01.',
    'Topología y dirección de flujo',
    visualTransferImpact,
  ),
  'PUMP-01': entry(
    'Impulsa la pulpa lixiviada hacia adsorción CIP.',
    'Pulpa desde lixiviación.',
    'Pulpa presurizada hacia CIP.',
    'Presión requerida · eficiencia de bomba/motor',
    'Conecta la demanda de transporte con carga, potencia eléctrica, energía y costo del caso sin cambiar endpoints ni diámetros físicos.',
  ),
  'P-PUMP-01-TO-CIP': entry(
    'Conecta la descarga de PUMP-01 con adsorción CIP.',
    'Pulpa lixiviada presurizada.',
    'Alimentación a CIP-ADSORPTION.',
    'Topología y dirección de flujo',
    visualTransferImpact,
  ),
  'CIP-ADSORPTION': entry(
    'Adsorbe el oro disuelto sobre carbón activado en el tren CIP.',
    'Pulpa lixiviada + carbón activo.',
    'Carbón cargado hacia elución y pulpa empobrecida.',
    'Eficiencia de adsorción ingresada',
    'La recuperación usa una eficiencia de etapa explícita. El simulador no predice cinética intrínseca de adsorción.',
  ),
  'MT-CIP-TO-ELUTION-CARBON': entry(
    'Representa el transporte de carbón cargado desde CIP hacia elución.',
    'Carbón cargado con oro.',
    'Carbón hacia ELUTION-SKID.',
    'Transferencia de carbón',
    'Forma parte de la topología del balance de recuperación; no añade una eficiencia oculta ni una ecuación de transporte adicional.',
  ),
  'ELUTION-SKID': entry(
    'Desorbe el oro del carbón cargado para producir una solución rica.',
    'Carbón cargado desde CIP.',
    'Solución rica hacia EW + carbón barren de retorno.',
    'Eficiencia de elución ingresada',
    'La masa recuperada se calcula con la eficiencia explícita de elución; no se predice eficiencia intrínseca del skid.',
  ),
  'MT-ELUTION-TO-CIP-BARREN-CARBON': entry(
    'Muestra el retorno del carbón barren desde elución hacia CIP.',
    'Carbón eluido.',
    'Carbón reciclado a adsorción.',
    'Recirculación de carbón',
    'Cierra visualmente el circuito de carbón; no modifica por sí solo el balance calculado de oro.',
  ),
  'P-ELUTION-TO-EW': entry(
    'Conduce solución rica desde elución hacia electrowinning.',
    'Solución rica en oro.',
    'Electrolito hacia EW-CELLS.',
    'Topología y dirección de flujo',
    'Representa continuidad entre etapas; la recuperación se gobierna por eficiencias explícitas, no por este tramo 3D.',
  ),
  'EW-CELLS': entry(
    'Recupera oro desde solución mediante electrodeposición.',
    'Solución rica desde elución.',
    'Depósito/cátodo hacia fundición.',
    'Eficiencia de electrowinning ingresada',
    'La recuperación de etapa aplica la eficiencia explícita de EW dentro del balance global.',
  ),
  'MT-EW-TO-SMELTING-CATHODE': entry(
    'Representa el traslado del producto de EW hacia fundición.',
    'Depósito/cátodo con metal recuperado.',
    'Carga metálica a SMELTING-FURNACE.',
    'Transferencia de producto',
    'Es una conexión de balance y visualización; no introduce pérdidas adicionales salvo las eficiencias explícitas del modelo.',
  ),
  'SMELTING-FURNACE': entry(
    'Funde el producto de recuperación para obtener la barra doré final.',
    'Producto metálico desde EW.',
    'Barra doré.',
    'Eficiencia de fundición ingresada',
    'Cierra el balance de recuperación global y la masa final de oro usando la eficiencia explícita de fundición.',
  ),
});

export const INSPECTION_COMPONENT_HOTSPOTS = Object.freeze({
  'PRIMARY-CRUSHER': Object.freeze([
    hotspot('Zona de alimentación', 'Recibe el mineral desde CV-01 y lo conduce hacia la cámara de chancado.', 'Entrada de mineral ROM/chancable.'),
    hotspot('Mandíbula móvil y fija', 'Generan la compresión mecánica que reduce el tamaño del mineral.', 'Reducción de tamaño representada visualmente; PULPA LAB no calcula P80.'),
    hotspot('Excéntrica y volantes', 'Transforman el giro del accionamiento en el movimiento oscilante de la mandíbula.', 'Movimiento mecánico educativo, sin modelo de potencia de chancado.'),
    hotspot('Accionamiento', 'Entrega movimiento al conjunto excéntrico de la chancadora.', 'No altera el solver hidráulico/reológico.'),
    hotspot('Descarga', 'Entrega mineral chancado hacia CV-02.', 'Continuidad visual hacia stockpile.'),
  ]),
  'MILL-01': Object.freeze([
    hotspot('Shell', 'Contiene la carga y define el cuerpo rotatorio del molino.', 'Geometría de equipo; no determina por sí sola la reología ingresada.'),
    hotspot('Carga interna', 'Representa mineral/medios dentro del volumen de molienda.', 'Interior educativo; no es DEM ni calcula distribución granulométrica.'),
    hotspot('Liners', 'Protegen el shell y ayudan al levantamiento de la carga.', 'Componente mecánico mostrado para inspección.'),
    hotspot('Accionamiento', 'Motor, reducción y corona transmiten el giro al molino.', 'No se usa para calcular energía específica de molienda.'),
    hotspot('Descarga', 'Entrega la pulpa formada hacia SUMP-01.', 'Conecta molienda con el circuito húmedo.'),
  ]),
  'SLURRY-PUMP-01': Object.freeze([
    hotspot('Succión', 'Recibe la pulpa desde SUMP-01.', 'Entrada hidráulica al equipo.'),
    hotspot('Carcasa / voluta', 'Conduce el flujo desde el impulsor hacia la descarga.', 'Geometría visual; no sustituye la curva de bomba ingresada.'),
    hotspot('Impulsor', 'Transfiere energía mecánica al fluido.', 'Relacionable con carga y potencia calculadas, sin CFD.'),
    hotspot('Motor y acoplamiento', 'Accionan el eje de la bomba.', 'La eficiencia de bomba/motor es un dato explícito del caso.'),
    hotspot('Descarga', 'Envía pulpa presurizada hacia CLASS-01.', 'Salida asociada a la presión/carga requerida del circuito.'),
  ]),
  'CLASS-01': Object.freeze([
    hotspot('Feed', 'Distribuye la alimentación de pulpa al cluster.', 'Entrada desde la bomba de clasificación.'),
    hotspot('Vortex finder / overflow', 'Representa la salida superior de la fracción clasificada.', 'Overflow visual hacia lixiviación; no se calcula d50.'),
    hotspot('Apex / underflow', 'Representa la descarga inferior de la fracción gruesa.', 'Underflow visual de retorno a molienda.'),
    hotspot('Manifold', 'Reparte la alimentación entre los ciclones del cluster.', 'Continuidad de proceso, no balance de partición calibrado.'),
  ]),
  'CIP-ADSORPTION': Object.freeze([
    hotspot('Feed', 'Recibe la pulpa lixiviada que ingresa al tren de adsorción.', 'Entrada del proceso CIP.'),
    hotspot('Tanques y agitadores', 'Mantienen contacto visualmente representado entre pulpa y carbón.', 'Animación educativa; no resuelve transferencia de masa intrínseca.'),
    hotspot('Interstage screens', 'Representan la retención de carbón entre etapas.', 'Separación operacional mostrada sin solver de clasificación.'),
    hotspot('Flujo de carbón', 'Representa el avance/retorno conceptual del carbón entre etapas.', 'La recuperación sigue gobernada por eficiencias explícitas.'),
    hotspot('Descarga', 'Entrega la corriente de proceso hacia las etapas posteriores.', 'Continuidad de la ruta CIP→elución.'),
  ]),
  'ELUTION-SKID': Object.freeze([
    hotspot('Columna de elución', 'Representa la etapa donde el oro se desorbe del carbón cargado.', 'Proceso educativo; no calcula equilibrio de desorción.'),
    hotspot('Tanque de solución', 'Contiene la solución de proceso del skid.', 'Nivel visual, no balance transiente del tanque.'),
    hotspot('Intercambiador de calor', 'Representa el acondicionamiento térmico de la solución.', 'No introduce un modelo térmico independiente.'),
    hotspot('Bombas / header', 'Recirculan y conducen la solución dentro del skid.', 'Continuidad visual; no añade curvas hidráulicas nuevas.'),
    hotspot('Solución pregnant', 'Salida de solución rica hacia EW-CELLS.', 'Conexión de proceso hacia electrowinning.'),
  ]),
});

export const PRESENTATION_STOP_IDS = Object.freeze([
  'EXCAVATOR-01',
  'TRUCK-01',
  'ROM-HOPPER',
  'APRON-FEEDER',
  'PRIMARY-CRUSHER',
  'STOCKPILE-RECLAIM',
  'MILL-01',
  'SUMP-01',
  'SLURRY-PUMP-01',
  'CLASS-01',
  'R-01',
  'R-02',
  'R-03',
  'R-04',
  'PUMP-01',
  'CIP-ADSORPTION',
  'ELUTION-SKID',
  'EW-CELLS',
  'SMELTING-FURNACE',
]);

export function getInspectionGuideEntry(id) {
  return INSPECTION_GUIDE[id] ?? null;
}

export function getInspectionComponentHotspots(id) {
  return INSPECTION_COMPONENT_HOTSPOTS[id] ?? Object.freeze([]);
}

export function getInspectionStage(id) {
  if (['EXCAVATOR-01', 'TRUCK-01'].includes(id)) return 'Mina · carguío y acarreo';
  if ([
    'ROM-HOPPER', 'ROM-TO-FEEDER-CHUTE', 'APRON-FEEDER',
    'CV-01-FEEDER-TO-CRUSHER', 'PRIMARY-CRUSHER',
    'CV-02-CRUSHER-TO-STOCKPILE', 'STOCKPILE-RECLAIM',
    'LOADER-01', 'CV-03-STOCKPILE-TO-GRINDING',
  ].includes(id)) return 'Recepción · chancado · almacenamiento';
  if ([
    'MILL-01', 'P-MILL-TO-SUMP', 'SUMP-01', 'P-SUMP-TO-PUMP',
    'SLURRY-PUMP-01', 'P-PUMP-TO-CYCLONES', 'CLASS-01',
    'P-CYCLONE-UNDERFLOW-RETURN', 'P-CLASSIFICATION-TO-LEACH',
  ].includes(id)) return 'Molienda · bombeo · clasificación';
  if (/^R-0[1-4]$/.test(id) || /^P-LEACH-R0[1-3]-R0[2-4]$/.test(id) || id === 'P-LEACHING-TO-PUMP-01') {
    return 'Lixiviación';
  }
  return 'Recuperación · CIP · elución · EW · fundición';
}

export function getInspectionRelatedResult(id) {
  if (['MILL-01'].includes(id)) return 'Densidad de pulpa · comportamiento reológico';
  if (['SLURRY-PUMP-01', 'PUMP-01'].includes(id)) return 'ΔP requerida · carga total · potencia · energía';
  if (id === 'P-LEACH-R01-R02') return 'Re / Re* · ΔP · carga total · potencia';
  if (/^R-0[1-4]$/.test(id)) return 'Residencia de lixiviación · conversión CSTR';
  if (['CIP-ADSORPTION', 'ELUTION-SKID', 'EW-CELLS', 'SMELTING-FURNACE'].includes(id)) {
    return 'Recuperación global · oro final';
  }
  if (id === 'SUMP-01') return 'Caudal de proceso · continuidad de balance';
  if (id === 'CLASS-01') return 'Clasificación conceptual · sin KPI independiente calculado';
  return 'Contexto/continuidad 3D · sin KPI independiente';
}

export function getPresentationStops() {
  return PRESENTATION_STOP_IDS.map((id) => Object.freeze({
    id,
    guide: getInspectionGuideEntry(id),
  }));
}
