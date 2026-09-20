import type { ReactNode } from "react";

export function PageHeading({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return <div className="zl-page-heading">
    <div className="zl-page-heading__copy"><h1 className="page-title">{title}</h1>{description ? <p className="zl-page-heading__description">{description}</p> : null}</div>
    {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
  </div>;
}
