import type { ReactNode } from 'react';

export interface CrudEntityViewField {
  label: string;
  value: ReactNode;
  fullWidth?: boolean;
}

export const CrudEntityView = ({
  fields,
}: {
  fields: readonly CrudEntityViewField[];
}) => (
  <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
    {fields.map((field) => (
      <div
        key={field.label}
        className={field.fullWidth ? 'sm:col-span-2' : undefined}
      >
        <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
          {field.label}
        </dt>
        <dd className="mt-1 break-words text-sm leading-6 text-slate-800">
          {field.value ?? '—'}
        </dd>
      </div>
    ))}
  </dl>
);
