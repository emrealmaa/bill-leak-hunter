import { useState, type DragEvent } from "react";
import { useI18n } from "../i18n";

interface Props {
  banks: readonly string[];
  onFile: (file: File) => void;
}

export function Welcome({ banks, onFile }: Props) {
  const { m } = useI18n();
  const [dragging, setDragging] = useState(false);

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }

  return (
    <section className="mx-auto max-w-2xl">
      <p className="text-lg text-slate-700 sm:text-xl">{m.welcome.tagline}</p>
      <ul className="mt-4 space-y-1 text-slate-600">
        {m.welcome.bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span aria-hidden="true" className="text-emerald-600">
              ✓
            </span>
            {b}
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="font-semibold text-emerald-900">{m.welcome.privacyTitle}</p>
        <p className="mt-1 text-sm text-emerald-900/80">{m.welcome.privacyBody}</p>
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`mt-6 flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition focus-within:ring-2 focus-within:ring-emerald-500 ${
          dragging ? "border-emerald-500 bg-emerald-50" : "border-slate-300 bg-white hover:bg-slate-50"
        }`}
      >
        <span className="text-lg font-medium text-slate-800">{m.welcome.dropTitle}</span>
        <span className="mt-1 text-sm text-slate-500">{m.welcome.dropHint}</span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onFile(file);
          }}
        />
      </label>

      <p className="mt-6 text-sm text-slate-600">
        <span className="font-medium">{m.welcome.supportedBanks}:</span> {banks.join(", ")}
      </p>
      <p className="mt-2 text-xs text-slate-500">{m.welcome.notAdvice}</p>
    </section>
  );
}
