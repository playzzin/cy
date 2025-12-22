export const ROLE_SITE_MAP: { [key: string]: string } = {
    '사장': 'safety',    // Managed as Safety/Leader Icon
    '실장': 'learning',  // Managed as Manager
    '팀장': 'equipment', // Managed as Team Leader
    '반장': 'foreman',   // Foreman
    '기공': 'skilled',   // Skilled Worker
    '일반': 'general',   // General Worker
    '신규': 'newcomer',  // Newcomer
    // Legacy maps (optional, keep for safety)
    '기능공': 'skilled',
    '일반공': 'general',
    '신규자': 'newcomer',
};

export const getSiteForRole = (role: string | undefined): string => {
    if (!role) return 'dashboard'; // Default fallback
    return ROLE_SITE_MAP[role] || 'dashboard';
};
