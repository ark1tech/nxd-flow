import type { ReactElement, ReactNode } from "react";

export function EmptyState({
  title,
  description,
  icon
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
}): ReactElement {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      {icon ? <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-canvas text-muted">{icon}</div> : null}
      <p className="text-[13px] font-medium text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-[240px] text-[12px] leading-relaxed text-muted">{description}</p> : null}
    </div>
  );
}
