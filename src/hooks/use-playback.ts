"use client";

import { useCallback, useEffect, useState } from "react";
import type { Message } from "@/game/types";

export function usePlayback(messages: Message[], loop: string, seen: Set<string>, remember: (text: string) => void, skipRead: boolean, reduced: boolean) {
  const [position, setPosition] = useState({ loop, count: 0, chars: -1 });
  const count = position.loop === loop ? Math.min(position.count, messages.length) : 0;
  const chars = position.loop === loop ? position.chars : -1;
  const current = messages[count];

  useEffect(() => {
    if (!current) return;
    let interval: ReturnType<typeof setInterval> | undefined;
    const signature = `${current.speaker}:${current.text}`;
    const instant = reduced || (skipRead && seen.has(signature)) || current.speaker === "YOU" || current.speaker === "SYSTEM";
    const finish = () => {
      remember(signature);
      setPosition({ loop, count: count + 1, chars: -1 });
    };
    const timeout = setTimeout(() => {
      if (instant) { finish(); return; }
      let length = 0;
      setPosition({ loop, count, chars: 0 });
      interval = setInterval(() => {
        length += 3;
        if (length >= current.text.length) { clearInterval(interval); finish(); }
        else setPosition({ loop, count, chars: length });
      }, current.effect === "quiet" ? 38 : 28);
    }, instant ? 20 : current.effect === "quiet" ? 850 : 320);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, [current, loop, count, skipRead, reduced, seen, remember]);

  const skip = useCallback(() => {
    for (const message of messages) remember(`${message.speaker}:${message.text}`);
    setPosition({ loop, count: messages.length, chars: -1 });
  }, [messages, loop, remember]);

  return { count, chars, current, busy: count < messages.length, skip };
}
