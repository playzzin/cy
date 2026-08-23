import type { ConstructionPlanTemplateBinding } from '../types';
import { sha256Hex } from '../services/a4RasterPdfWriter';

/** Matches the server canonical JSON key ordering used for immutable hashes. */
export const canonicalConstructionPlanTemplateBindingJson = (value: unknown): string => JSON.stringify(
  value,
  (_key, candidate) => {
    if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) {
      return candidate;
    }
    return Object.keys(candidate as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = (candidate as Record<string, unknown>)[key];
        return result;
      }, {});
  },
);

const utf8Bytes = (value: string): Uint8Array => {
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const point = value.codePointAt(index) as number;
    if (point > 0xffff) index += 1;
    if (point <= 0x7f) bytes.push(point);
    else if (point <= 0x7ff) bytes.push(0xc0 | (point >> 6), 0x80 | (point & 0x3f));
    else if (point <= 0xffff) {
      bytes.push(0xe0 | (point >> 12), 0x80 | ((point >> 6) & 0x3f), 0x80 | (point & 0x3f));
    } else {
      bytes.push(
        0xf0 | (point >> 18),
        0x80 | ((point >> 12) & 0x3f),
        0x80 | ((point >> 6) & 0x3f),
        0x80 | (point & 0x3f),
      );
    }
  }
  return Uint8Array.from(bytes);
};

export const constructionPlanTemplateBindingHash = (
  binding: ConstructionPlanTemplateBinding,
): string => sha256Hex(
  utf8Bytes(canonicalConstructionPlanTemplateBindingJson(binding)),
);
