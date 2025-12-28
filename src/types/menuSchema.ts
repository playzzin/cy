import { z } from 'zod';

// Recursive schema definition for MenuItem
export const MenuItemSchema: z.ZodType<any> = z.lazy(() =>
    z.object({
        text: z.string().min(1, "메뉴명은 필수입니다."), // Text is required
        icon: z.string().optional(),
        path: z.string().optional(),
        id: z.string().optional(), // ID might be missing in legacy data, but we encourage it
        roles: z.array(z.string()).optional(),
        hoverColor: z.string().optional(), // Rollover Color
        iconColor: z.string().optional(),
        activeColor: z.string().optional(),
        hide: z.boolean().optional(),
        sub: z.array(z.string().or(MenuItemSchema)).optional()
    })
);

export const SiteDataSchema = z.object({
    name: z.string(),
    icon: z.string(),
    order: z.number().optional(),
    menu: z.array(MenuItemSchema),
    trash: z.array(MenuItemSchema).optional(),
    deletedItems: z.array(z.string()).optional(),
    positionConfig: z.array(z.object({
        id: z.string(),
        name: z.string(),
        icon: z.string(),
        color: z.string(),
        order: z.number().optional()
    })).optional()
});

export const SiteDataTypeSchema = z.record(z.string(), SiteDataSchema);

// Types inferred from Schema
export type MenuItemSchemaType = z.infer<typeof MenuItemSchema>;
export type SiteDataSchemaType = z.infer<typeof SiteDataSchema>;
export type SiteDataTypeSchemaType = z.infer<typeof SiteDataTypeSchema>;
