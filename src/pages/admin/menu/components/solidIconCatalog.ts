import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

// Keep the complete icon catalog in the package's CommonJS entry. Named ESM
// imports used by the rest of the app can then keep only the icons they render.
const solidIcons: typeof import('@fortawesome/free-solid-svg-icons') = require('@fortawesome/free-solid-svg-icons');

export const solidIconCatalog = Object.entries(solidIcons)
    .filter((entry): entry is [string, IconDefinition] => entry[0].startsWith('fa') && entry[0] !== 'fas')
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
