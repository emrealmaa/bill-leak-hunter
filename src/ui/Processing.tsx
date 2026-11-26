import { useI18n } from "../i18n";

export function Processing() {
  const { m } = useI18n();
  return (
    <section className="mx-auto flex max-w-md flex-col items-center py-16 text-center" role="status" aria-live="polite">
      <span
        aria-hidden="true"
        className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600 motion-reduce:animate-none"
      />
      <p className="mt-4 text-lg font-medium text-slate-800">{m.processing.title}</p>
      <p className="mt-1 text-sm text-slate-500">{m.processing.body}</p>
    </section>
  );
}
