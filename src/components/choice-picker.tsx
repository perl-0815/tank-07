"use client";

import { useEffect, useRef } from "react";
import type { Choice } from "@/game/types";

export function ChoicePicker({ choices, open, disabled, onOpenChange, onSelect }: {
  choices: Choice[];
  open: boolean;
  disabled: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const groups = [...new Set(choices.map((choice) => choice.group ?? "応答"))];
  const expanded = open && !disabled;

  useEffect(() => {
    // A timer event can share new information while the drawer is open.
    // Receive that dialogue before offering the resulting responses.
    if (disabled && open) {
      const focused = document.activeElement;
      if (!document.querySelector("dialog[open]") && (focused === document.body || root.current?.contains(focused))) {
        toggle.current?.focus({ preventScroll: true });
      }
      onOpenChange(false);
    }
  }, [disabled, open, onOpenChange]);

  useEffect(() => {
    if (!expanded) return;
    if (list.current) list.current.scrollTop = 0;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || document.querySelector("dialog[open]")) return;
      event.preventDefault();
      onOpenChange(false);
      toggle.current?.focus({ preventScroll: true });
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) onOpenChange(false);
    };
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", escape);
      document.removeEventListener("pointerdown", outside);
    };
  }, [expanded, onOpenChange]);

  return <div className="choice-picker" ref={root}>
    {/* Keep the return target focusable while receiving, without allowing it to open. */}
    <button ref={toggle} type="button" className="choice-toggle" aria-expanded={expanded} aria-controls="response-choices" aria-disabled={disabled || choices.length === 0} disabled={choices.length === 0} onClick={() => { if (!disabled) onOpenChange(!expanded); }}>
      <span>{expanded ? "選択肢を閉じる" : "選択肢を開く"}</span>
      <span className="choice-count" aria-hidden="true">{choices.length}</span>
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 10 4-4 4 4" /></svg>
    </button>
    <div id="response-choices" className="choice-drawer" role="region" aria-label="応答の選択肢" hidden={!expanded}>
      <div className="choice-drawer-heading">応答を選択</div>
      <div ref={list} className="choices">
        {groups.map((group) => <section key={group} className="choice-group" aria-label={group}>
          <h3>{group}</h3>
          <div className="choice-group-items">{choices.filter((choice) => (choice.group ?? "応答") === group).map((choice) => <button key={choice.id} type="button" className={choice.fromRecord ? "record-choice" : undefined} disabled={disabled} onClick={() => {
            onSelect(choice.id);
            onOpenChange(false);
            toggle.current?.focus({ preventScroll: true });
          }}>
            <span className="choice-label">{choice.fromRecord && <span className="record-tag">記録より</span>}{choice.label}</span>
            <span className="choice-cost" aria-label={`所要${choice.cost}秒`}>{choice.cost ? `−${choice.cost}s` : "↵"}</span>
          </button>)}</div>
        </section>)}
      </div>
    </div>
  </div>;
}
