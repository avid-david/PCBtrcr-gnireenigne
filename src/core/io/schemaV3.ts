import { z } from 'zod';
import { projectV2 } from './schemaV2';

// The project file format, version 3 (docs/adr/0008): version 2 plus the names, colours and
// locks the user gave nets. Never change a released version: add a new one and a migration.

const netStyle = z.object({
  anchor: z.string().min(1),
  name: z.string().nullable(),
  color: z.number().int().min(0).max(0xffffff).nullable(),
  locked: z.boolean(),
});

export const projectV3 = projectV2.extend({ netStyles: z.array(netStyle) });

export const documentV3 = z.object({
  schemaVersion: z.literal(3),
  project: projectV3,
});
