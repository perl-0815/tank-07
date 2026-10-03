"use client";

import { useEffect, useRef, useState } from "react";
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
  const scrollArea = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const scrollUp = useRef<HTMLButtonElement>(null);
  const scrollDown = useRef<HTMLButtonElement>(null);
  const [scroll, setScroll] = useState({ overflow: false, above: false, below: false });
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

  useEffect(() => {
    const viewport = list.current;
    const area = scrollArea.current;
    const contents = content.current;
    if (!expanded || !viewport || !area || !contents) return;
    let frame = 0;
    const measure = () => {
      // Compare against the whole area, excluding the optional hint bar's
      // footprint, so adding that bar cannot create its own overflow state.
      const overflow = viewport.scrollHeight > area.clientHeight + 2;
      const above = overflow && viewport.scrollTop > 2;
      const below = overflow && viewport.scrollTop + viewport.clientHeight < viewport.scrollHeight - 2;
      const focused = document.activeElement;
      if ((!above && focused === scrollUp.current) || (!below && focused === scrollDown.current)) {
        viewport.focus({ preventScroll: true });
      }
      setScroll((previous) => previous.overflow === overflow && previous.above === above && previous.below === below
        ? previous : { overflow, above, below });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(area);
    observer.observe(viewport);
    observer.observe(contents);
    viewport.addEventListener("scroll", schedule, { passive: true });
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      viewport.removeEventListener("scroll", schedule);
    };
  }, [expanded]);

  const moveList = (direction: -1 | 1) => {
    const viewport = list.current;
    if (!viewport) return;
    viewport.scrollBy({ top: direction * Math.max(44, viewport.clientHeight * .75), behavior: "auto" });
  };

  return <div className="choice-picker" ref={root}>
    {/* Keep the return target focusable while receiving, without allowing it to open. */}
    <button ref={toggle} type="button" className="choice-toggle" aria-expanded={expanded} aria-controls="response-choices" aria-disabled={disabled || choices.length === 0} disabled={choices.length === 0} onClick={() => { if (!disabled) onOpenChange(!expanded); }}>
      <span>{expanded ? "選択肢を閉じる" : "選択肢を開く"}</span>
      <span className="choice-count" aria-hidden="true">{choices.length}</span>
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 10 4-4 4 4" /></svg>
    </button>
    <div id="response-choices" className="choice-drawer" role="region" aria-label="応答の選択肢" hidden={!expanded}>
      <div className="choice-drawer-heading"><span>応答を選択</span><button ref={scrollUp} type="button" className="choice-scroll-hint" aria-label="上に戻る" aria-controls="choice-list" hidden={!scroll.above} onClick={() => moveList(-1)}><span aria-hidden="true">↑</span>上に戻る</button></div>
      <div ref={scrollArea} className="choice-scroll-area">
      <div id="choice-list" ref={list} className="choices" role="group" aria-label="応答候補一覧" tabIndex={-1}>
        <div ref={content} className="choice-groups">
        {groups.map((group) => <section key={group} className="choice-group" aria-label={group}>
          <h3>{group}</h3>
          <div className="choice-group-items">{choices.filter((choice) => (choice.group ?? "応答") === group).map((choice) => <button key={choice.id} type="button" className={[choice.fromRecord && "record-choice", choice.selected && "selected-choice"].filter(Boolean).join(" ") || undefined} disabled={disabled} onClick={() => {
            onSelect(choice.id);
            onOpenChange(false);
            toggle.current?.focus({ preventScroll: true });
          }}>
            <span className="choice-label">{choice.fromRecord && <span className="record-tag">記録より</span>}{choice.selected && <><span className="selected-mark" aria-hidden="true">✓</span><span className="sr-only">選択済み：</span></>}{choice.label}</span>
            <span className="choice-cost" aria-label={`所要${choice.cost}秒`}>{choice.cost ? `−${choice.cost}s` : "↵"}</span>
          </button>)}</div>
        </section>)}
        </div>
      </div>
      <div className="choice-scroll-footer" hidden={!scroll.overflow}><button ref={scrollDown} type="button" className="choice-scroll-hint" aria-label="下に続き" aria-controls="choice-list" hidden={!scroll.below} onClick={() => moveList(1)}>下に続き<span aria-hidden="true">↓</span></button></div>
      </div>
    </div>
  </div>;
}
