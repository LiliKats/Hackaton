import React from 'react';

interface NotificationBadgeProps {
  count: number;
  max?: number;
  className?: string;
}

const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  count,
  max = 99,
  className = ''
}) => {
  if (count <= 0) return null;

  const displayCount = count > max ? `${max}+` : count.toString();

  return (
    <span className={`inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full min-w-5 h-5 ${className}`}>
      {displayCount}
    </span>
  );
};

export default NotificationBadge;