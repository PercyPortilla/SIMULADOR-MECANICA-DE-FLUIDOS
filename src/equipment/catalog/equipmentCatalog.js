import { createHaulTruckAsset } from '../mining/haulTruck.js';
import { createMiningShovelAsset } from '../mining/miningShovel.js';
import { createWheelLoaderAsset } from '../mining/wheelLoader.js';
import { createRomHopperAsset } from '../crushing/romHopper.js';
import { createApronFeederAsset } from '../crushing/apronFeeder.js';
import { createJawCrusherAsset } from '../crushing/jawCrusher.js';
import { createConveyorAsset } from '../conveying/conveyor.js';
import { createBallMillAsset } from '../grinding/ballMill.js';
import { createSlurryPumpAsset } from '../classification/slurryPump.js';
import { createCycloneClusterAsset } from '../classification/cycloneCluster.js';
import { createLeachReactorAsset } from '../leaching/leachReactor.js';
import { createCipAsset } from '../recovery/cip.js';
import { createElutionAsset } from '../recovery/elution.js';
import { createElectrowinningAsset } from '../recovery/electrowinning.js';
import { createSmeltingFurnaceAsset } from '../recovery/smeltingFurnace.js';

export const EQUIPMENT_CATALOG = Object.freeze([
  { key: 'haulTruck', label: 'Haul Truck · 90–100 t', category: 'Minería móvil', create: createHaulTruckAsset },
  { key: 'miningShovel', label: 'Mining Shovel · gran minería', category: 'Minería móvil', create: createMiningShovelAsset },
  { key: 'wheelLoader', label: 'Wheel Loader · gran minería', category: 'Minería móvil', create: createWheelLoaderAsset },
  { key: 'romHopper', label: 'ROM Hopper', category: 'Recepción', create: createRomHopperAsset },
  { key: 'apronFeeder', label: 'Apron Feeder', category: 'Recepción', create: createApronFeederAsset },
  { key: 'jawCrusher', label: 'Primary Jaw Crusher', category: 'Chancado', create: createJawCrusherAsset },
  { key: 'conveyor', label: 'Conveyor modular · 16 m', category: 'Transporte sólido', create: () => createConveyorAsset({ length: 16, width: 1.45, incline: 0.08, supportSpacing: 4, walkway: true }) },
  { key: 'ballMill', label: 'Ball Mill · Ø4.5 × 7 m', category: 'Molienda', create: createBallMillAsset },
  { key: 'slurryPump', label: 'Slurry Pump', category: 'Clasificación', create: createSlurryPumpAsset },
  { key: 'cycloneCluster', label: 'Hydrocyclone Cluster · 6×500 mm', category: 'Clasificación', create: createCycloneClusterAsset },
  { key: 'leachReactor', label: 'Leach Reactor · Ø7 m', category: 'Lixiviación', create: createLeachReactorAsset },
  { key: 'cip', label: 'CIP Adsorption Module', category: 'Recuperación', create: createCipAsset },
  { key: 'elution', label: 'Elution Skid', category: 'Recuperación', create: createElutionAsset },
  { key: 'electrowinning', label: 'Electrowinning Cells', category: 'Recuperación', create: createElectrowinningAsset },
  { key: 'smelting', label: 'Smelting Furnace', category: 'Recuperación', create: createSmeltingFurnaceAsset },
]);

export function getCatalogEntry(key) {
  return EQUIPMENT_CATALOG.find((entry) => entry.key === key) || null;
}

export function createCatalogAsset(key) {
  const entry = getCatalogEntry(key);
  if (!entry) throw new RangeError(`Unknown catalog asset: ${key}`);
  return entry.create();
}
