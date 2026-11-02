import { z } from 'zod';
import { SIDEBAR_FONT_IDS } from '../constants/sidebarFonts';

const hexColor = z.string().regex(/^#[\da-f]{6}$/i);
const sidebarFont = z.enum(SIDEBAR_FONT_IDS).optional();

// Recursive schema definition for MenuItem
export const MenuItemSchema: z.ZodType<any> = z.lazy(() =>
    z.object({
        text: z.string().min(1, "메뉴명은 필수입니다."), // Text is required
        icon: z.string().optional(),
        path: z.string().optional(),
        action: z.string().optional(),
        id: z.string().optional(), // ID might be missing in legacy data, but we encourage it
        roles: z.array(z.string()).optional(),
        hoverColor: z.string().optional(), // Rollover Color
        iconColor: z.string().optional(),
        activeColor: z.string().optional(),
        backgroundColor: hexColor.optional(),
        selectedBackgroundColor: hexColor.optional(),
        fontPreset: sidebarFont,
        hide: z.boolean().optional(),
        dividerTitle: z.string().optional(),
        dividerStyle: z.enum(['solid', 'dashed']).optional(),
        dividerSpacing: z.enum(['compact', 'normal', 'relaxed']).optional(),
        sub: z.array(z.string().or(MenuItemSchema)).optional()
    })
);

export const SiteDataSchema = z.object({
    name: z.string(),
    icon: z.string(),
    order: z.number().optional(),
    delegationTemplatePath: z.string().optional(),
    menu: z.array(MenuItemSchema),
    headerActions: z.array(MenuItemSchema).optional(),
    sidebarSearchEnabled: z.boolean().optional(),
    sidebarAccentColor: hexColor.optional(),
    sidebarBackgroundColor: hexColor.optional(),
    sidebarSelectedBackgroundColor: hexColor.optional(),
    sidebarFontPreset: sidebarFont,
    menuRegistrationVersion: z.number().int().positive().optional(),
    linkedPositionGroups: z.array(z.object({ sourceSite: z.string().min(1), text: z.string().optional() })).optional(),
    linkedPositionMenusEnabled: z.boolean().optional(),
    linkedPositionDivider: z.object({
        dividerTitle: z.string().optional(),
        dividerStyle: z.enum(['solid', 'dashed']).optional(),
        dividerSpacing: z.enum(['compact', 'normal', 'relaxed']).optional(),
        hide: z.boolean().optional()
    }).optional(),
    trash: z.array(MenuItemSchema).optional(),
    deletedItems: z.array(z.string()).optional(),
    systemPageLabels: z.record(z.string(), z.string().min(1)).optional(),
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
