import { useI18n, type Messages } from "../i18n";

export type AppErrorCode = Exclude<keyof Messages["errors"], "title" | "retry">;

interface Props {
  code: AppErrorCode;
  onRetry: () => void;
}

export function ErrorView({ code, onRetry }: Props) {
  const { m } = useI18n();
  return (
    <section className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6" role="alert">
      <h2 className="text-lg font-semibold text-red-900">{m.errors.title}</h2>
      <p className="mt-2 text-red-900/90">{m.errors[code]}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-lg bg-red-700 px-4 py-2 font-medium text-white hover:bg-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
      >
        {m.errors.retry}
      </button>
    </section>
  );
}
