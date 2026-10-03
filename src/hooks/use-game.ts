"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { advanceTime, createGame, performAction, reconnect, startGame, submitKeyword } from "@/game/engine";
import { FACTS } from "@/game/scenario";
import type { GameState } from "@/game/types";

const STORAGE_KEY = "abyssal-7.memory.v1";

export function useGame() {
  const [game, setGame] = useState<GameState>(createGame);
  const [ready, setReady] = useState(false);
  const [saveWarning, setSaveWarning] = useState(false);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const clock = useRef(0);
  const lock = useRef(false);
  const [connecting, setConnecting] = useState(false);
  const [generation, setGeneration] = useState(0);
  const connectionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Unlock after the update has committed. Playback now owns the disabled UI.
    // A fixed timeout would reject legitimate input after very short replies.
    if (!connecting) lock.current = false;
  }, [game.messages, connecting]);

  useEffect(() => {
    // Restore only the observer's memory. Facility state never crosses sessions.
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const data: unknown = JSON.parse(raw);
          if (data && typeof data === "object" && "facts" in data && "loop" in data) {
            const memory = data as { facts: unknown; loop: unknown; started?: unknown; seen?: unknown };
            const facts = Array.isArray(memory.facts) ? memory.facts.filter((id): id is string => typeof id === "string" && Object.hasOwn(FACTS, id)) : [];
            const loop = typeof memory.loop === "number" && Number.isSafeInteger(memory.loop) && memory.loop > 0 ? memory.loop : 1;
            setGame({ ...createGame(), knownFacts: [...new Set(facts)], loopCount: Math.min(loop + (memory.started === true ? 1 : 0), 999999) });
            if (Array.isArray(memory.seen)) setSeen(new Set(memory.seen.filter((text): text is string => typeof text === "string").slice(-1500)));
          }
        }
      } catch { setSaveWarning(true); }
      setReady(true);
    });
    return () => { if (connectionTimeout.current) clearTimeout(connectionTimeout.current); };
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ facts: game.knownFacts, loop: game.loopCount, started: game.status !== "idle", seen: [...seen].slice(-1500) }));
    } catch { queueMicrotask(() => setSaveWarning(true)); }
  }, [game.knownFacts, game.loopCount, game.status, seen, ready]);

  const elapsed = useCallback(() => {
    const now = Date.now();
    const seconds = Math.max(0, Math.floor((now - clock.current) / 1000));
    clock.current += seconds * 1000;
    return seconds;
  }, []);

  useEffect(() => {
    if (!ready || game.status !== "playing" || game.containmentReleased || connecting) return;
    const tick = () => {
      const seconds = elapsed();
      if (seconds > 0) setGame((current) => advanceTime(current, seconds));
    };
    const interval = setInterval(tick, 200);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", tick); };
  }, [ready, game.status, game.containmentReleased, connecting, elapsed]);

  const connect = useCallback(() => {
    if (lock.current) return;
    lock.current = true;
    setConnecting(true);
    connectionTimeout.current = setTimeout(() => {
      clock.current = Date.now();
      setGame((current) => current.status === "idle" ? startGame(current) : reconnect(current));
      setConnecting(false);
      lock.current = false;
    }, 850);
  }, []);

  const act = useCallback((value: string, keyword = false) => {
    if (lock.current || !value.trim()) return;
    lock.current = true;
    const seconds = elapsed();
    setGame((current) => {
      const live = advanceTime(current, seconds);
      return keyword ? submitKeyword(live, value) : performAction(live, value);
    });
  }, [elapsed]);

  const remember = useCallback((text: string) => {
    setSeen((previous) => previous.has(text) ? previous : new Set([...previous, text]));
  }, []);

  const reset = useCallback(() => {
    if (connectionTimeout.current) clearTimeout(connectionTimeout.current);
    lock.current = false;
    setConnecting(false);
    setSeen(new Set());
    setGame(createGame());
    setGeneration((current) => current + 1);
  }, []);

  return { game, ready, saveWarning, seen, remember, connecting, connect, act, reset, generation };
}
