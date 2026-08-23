import { z } from 'zod';
import { SafeWorkerDtoSchema } from './constructionPlan';

/**
 * The only worker shape allowed to cross the construction-plan directory
 * boundary. Contact, identity, payroll, banking and address fields are absent.
 */
export const SafeWorkerDirectoryEntrySchema = SafeWorkerDtoSchema.omit({
  contact: true,
  photoUrl: true,
});

export const SafeWorkerDirectoryScopeSchema = z.object({
  siteId: z.string().min(1),
  responsibleTeamId: z.string().min(1).optional(),
  includeInactive: z.boolean().optional(),
});

export type SafeWorkerDirectoryEntry = z.infer<typeof SafeWorkerDirectoryEntrySchema>;
export type SafeWorkerDirectoryScope = z.input<typeof SafeWorkerDirectoryScopeSchema>;
