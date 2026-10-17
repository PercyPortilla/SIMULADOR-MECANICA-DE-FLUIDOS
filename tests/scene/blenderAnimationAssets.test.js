import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const assetRoot = path.resolve(here, '../../public/models/pulpa-blender');

function readGlbJson(filename) {
  const buffer = fs.readFileSync(path.join(assetRoot, filename));
  expect(buffer.subarray(0, 4).toString('ascii')).toBe('glTF');
  expect(buffer.readUInt32LE(4)).toBe(2);
  expect(buffer.readUInt32LE(8)).toBe(buffer.length);
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    offset += 8;
    const chunk = buffer.subarray(offset, offset + chunkLength);
    offset += chunkLength;
    if (chunkType === 0x4e4f534a) {
      return JSON.parse(chunk.toString('utf8').replace(/[\u0000\s]+$/g, ''));
    }
  }
  throw new Error(`${filename}: JSON chunk missing`);
}

function animationTargets(document) {
  const nodes = document.nodes ?? [];
  return (document.animations ?? []).flatMap((animation) => (
    (animation.channels ?? []).map((channel) => {
      const target = channel.target ?? {};
      return `${nodes[target.node]?.name ?? '<unknown>'}:${target.path ?? '<unknown>'}`;
    })
  ));
}

const EXPECTED_CHANNELS = Object.freeze({
  'APRON-FEEDER.glb': [
    'APRON-FEEDER_PANS_GROUP:translation',
    'APRON-FEEDER_ROTOR_01:rotation',
    'APRON-FEEDER_ROTOR_02:rotation',
  ],
  'PRIMARY-CRUSHER.glb': [
    'PRIMARY-CRUSHER_MOVING_JAW:rotation',
    'PRIMARY-CRUSHER_FLYWHEEL_01:rotation',
    'PRIMARY-CRUSHER_FLYWHEEL_02:rotation',
    'PRIMARY-CRUSHER_ECCENTRIC:rotation',
  ],
  'MILL-01.glb': ['MILL-01_ROTATING_GROUP:rotation'],
  'SLURRY-PUMP-01.glb': ['SLURRY-PUMP-01_ROTATING_GROUP:rotation'],
  'LEACH-REACTOR.glb': ['LEACH-REACTOR_ROTATING_GROUP:rotation'],
  'CIP-ADSORPTION.glb': [
    'CIP-ADSORPTION_ROTATING_-5.00:rotation',
    'CIP-ADSORPTION_ROTATING_-1.67:rotation',
    'CIP-ADSORPTION_ROTATING_+1.67:rotation',
    'CIP-ADSORPTION_ROTATING_+5.00:rotation',
  ],
  'SMELTING-FURNACE.glb': ['SMELTING-FURNACE_TILT_PIVOT:rotation'],
  'MINING-SHOVEL.glb': [
    'MINING-SHOVEL_UPPER:rotation',
    'MINING-SHOVEL_BOOM_PIVOT:rotation',
    'MINING-SHOVEL_STICK_PIVOT:rotation',
    'MINING-SHOVEL_BUCKET_PIVOT:rotation',
  ],
  'WHEEL-LOADER.glb': [
    'WHEEL-LOADER_ARTICULATION:rotation',
    'WHEEL-LOADER_ARM_PIVOT:rotation',
    'WHEEL-LOADER_BUCKET_PIVOT:rotation',
    'WHEEL-LOADER_WHEEL_FL:rotation',
    'WHEEL-LOADER_WHEEL_FR:rotation',
    'WHEEL-LOADER_WHEEL_RL:rotation',
    'WHEEL-LOADER_WHEEL_RR:rotation',
  ],
});

describe('Blender animation asset channels', () => {
  for (const [filename, expectedChannels] of Object.entries(EXPECTED_CHANNELS)) {
    it(`${filename} exports every required animated target`, () => {
      const document = readGlbJson(filename);
      expect(document.animations?.length).toBeGreaterThan(0);
      const targets = animationTargets(document);
      expectedChannels.forEach((channel) => expect(targets).toContain(channel));
    });
  }

  it('HAUL-TRUCK remains clip-free and exposes semantic control nodes', () => {
    const document = readGlbJson('HAUL-TRUCK.glb');
    expect(document.animations ?? []).toHaveLength(0);
    const names = new Set((document.nodes ?? []).map((node) => node.name));
    [
      'HAUL-TRUCK_DUMP_PIVOT',
      'HAUL-TRUCK_WHEEL_STEER_FL',
      'HAUL-TRUCK_WHEEL_STEER_FR',
      'HAUL-TRUCK_WHEEL_SPIN_FL',
      'HAUL-TRUCK_WHEEL_SPIN_FR',
      'HAUL-TRUCK_ORE_LOAD',
    ].forEach((name) => expect(names.has(name)).toBe(true));
  });
});
