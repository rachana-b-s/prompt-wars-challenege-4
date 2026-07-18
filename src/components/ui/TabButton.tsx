/**
 * TabButton — Reusable accessible tab button component.
 * Follows WAI-ARIA tab pattern.
 */

export interface TabButtonProps {
  id: string;
  label: string;
  isActive: boolean;
  panelId: string;
  onClick: () => void;
  variant?: 'default' | 'compact';
}

export function TabButton({ id, label, isActive, panelId, onClick, variant = 'default' }: TabButtonProps) {
  const baseClass = variant === 'compact'
    ? 'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors focus:outline-2 focus:outline-blue-600 focus:outline-offset-[-2px]'
    : 'flex-shrink-0 px-3 py-3 text-sm font-medium transition-colors focus:outline-2 focus:outline-blue-600 focus:outline-offset-[-2px]';

  const activeClass = variant === 'compact'
    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
    : 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400';

  const inactiveClass = 'text-gray-800 dark:text-gray-200 hover:text-gray-900 dark:hover:text-gray-100';

  return (
    <button
      id={id}
      role="tab"
      aria-selected={isActive}
      aria-controls={panelId}
      tabIndex={isActive ? 0 : -1}
      onClick={onClick}
      className={`${baseClass} ${isActive ? activeClass : inactiveClass}`}
    >
      {label}
    </button>
  );
}
