import type { ReactNode } from 'react';

export function ViewStatus({ title, children, action }: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="view-status">
      <div role="status">
        <p className="view-status-title">{title}</p>
        {children && <p className="view-status-detail">{children}</p>}
      </div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
