/**
 * StatusBadge — Shared UI component for displaying open/closed/limited status.
 * Reusable across facility cards and other contexts.
 */

export type BadgeStatus = 'open' | 'closed' | 'limited';

export interface StatusBadgeProps {
  status: BadgeStatus;
}

/**
 * Renders a small colored badge indicating open/closed/limited status.
 */
export function StatusBadge({ status }: StatusBadgeProps) {
  const styles: Record<BadgeStatus, string> = {
    open: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400',
    closed: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
    limited: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400',
  };

  return (
    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${styles[status]}`}>
      {status}
    </span>
  );
}
