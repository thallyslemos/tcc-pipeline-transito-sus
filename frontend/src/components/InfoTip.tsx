"use client";

import { Info, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { glossario, type GlossarioEntry, type TermoGlossario } from "@/content/glossario";

interface Props {
  termo: TermoGlossario;
  /** Classe extra no botao-gatilho (ex.: para ajustar posicionamento no chamador). */
  className?: string;
}

interface Position {
  top: number;
  left: number;
}

const POPOVER_WIDTH = 280;
const VIEWPORT_MARGIN = 8;

function computePosition(trigger: HTMLElement): Position {
  const rect = trigger.getBoundingClientRect();
  let left = rect.right - POPOVER_WIDTH;
  left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN));
  const top = rect.bottom + 6;
  return { top, left };
}

export default function InfoTip({ termo, className }: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const entry = glossario[termo];

  useEffect(() => {
    if (!open) return;

    const close = () => setOpen(false);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  if (!entry) return null;

  const toggle = () => {
    if (!open && triggerRef.current) {
      setPosition(computePosition(triggerRef.current));
    }
    setOpen((value) => !value);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Ajuda: ${entry.titulo}`}
        aria-expanded={open}
        onClick={toggle}
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--bg-muted)] ${className ?? ""}`}
        style={{ color: "var(--fg-muted)" }}
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && position && (
        <InfoTipPopover
          entry={entry}
          position={position}
          popoverRef={popoverRef}
          onClose={() => {
            setOpen(false);
            triggerRef.current?.focus();
          }}
        />
      )}
    </>
  );
}

function InfoTipPopover({
  entry,
  position,
  popoverRef,
  onClose,
}: {
  entry: GlossarioEntry;
  position: Position;
  popoverRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={entry.titulo}
      className="fixed z-50 rounded-xl p-3 text-xs shadow-lg"
      style={{
        top: position.top,
        left: position.left,
        width: POPOVER_WIDTH,
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-lg)",
        color: "var(--fg-secondary)",
      }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-[13px] font-semibold" style={{ color: "var(--fg)" }}>
          {entry.titulo}
        </p>
        <button
          type="button"
          aria-label="Fechar"
          onClick={onClose}
          className="shrink-0 rounded-full p-0.5 hover:bg-[var(--bg-muted)]"
          style={{ color: "var(--fg-muted)" }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <dl className="space-y-2">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--fg-muted)" }}>
            O que é
          </dt>
          <dd className="mt-0.5">{entry.oQueE}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--fg-muted)" }}>
            Como se lê
          </dt>
          <dd className="mt-0.5">{entry.comoSeLe}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--warning)" }}>
            Cuidado
          </dt>
          <dd className="mt-0.5">{entry.cuidado}</dd>
        </div>
      </dl>
    </div>,
    document.body
  );
}
