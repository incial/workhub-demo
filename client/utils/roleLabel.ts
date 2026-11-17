/** Display name for a role. ROLE_PRODUCTION is shown as "Procurement" in this build. */
export const formatRoleLabel = (role?: string | null): string => {
  if (!role) return '';
  if (role === 'ROLE_PRODUCTION') return 'PROCUREMENT';
  if (role === 'ROLE_SALES_COORDINATOR') return 'SALES COORDINATOR';
  return role.replace(/^ROLE_/, '').replace(/_/g, ' ');
};
