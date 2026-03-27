"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteEvent } from "@/app/actions";

type DeleteEventButtonProps = {
  slug: string;
  title: string;
};

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

export function DeleteEventButton({ slug, title }: DeleteEventButtonProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteEvent(slug);
        dialogRef.current?.close();
        router.refresh();
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Noe gikk galt ved sletting",
        );
      }
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label={`Slett arrangement «${title}»`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setError(null);
          dialogRef.current?.showModal();
        }}
        className="flex shrink-0 items-center justify-center self-stretch rounded-md border border-red-400/35 px-3 text-red-200 hover:bg-red-950/40"
      >
        <TrashIcon className="h-5 w-5" />
      </button>

      <dialog
        ref={dialogRef}
        className="fixed left-1/2 top-1/2 z-50 max-h-[min(100dvh-2rem,32rem)] w-[min(100%,24rem)] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-card p-4 text-card-foreground shadow-xl backdrop:bg-black/60"
        onClose={() => setError(null)}
      >
        <h2 className="text-lg font-semibold">Slette arrangement?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Er du sikker på at du vil slette «{title}»? Alle deltakere og
          tilgjengelighet blir permanent fjernet. Dette kan ikke angres.
        </p>
        {error ? (
          <p className="mt-3 text-sm text-red-200" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            disabled={isPending}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted disabled:opacity-60"
          >
            Avbryt
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="rounded-md border border-red-400/35 px-3 py-2 text-sm text-red-200 hover:bg-red-950/40 disabled:opacity-60"
          >
            {isPending ? "Sletter…" : "Slett"}
          </button>
        </div>
      </dialog>
    </>
  );
}
