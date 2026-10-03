"use client";

import { useEffect, useRef, useState } from "react";
import { getChoices } from "@/game/engine";
import { FACTS } from "@/game/scenario";
import { IMAGES } from "@/game/images";
import type { Message } from "@/game/types";
import { useGame } from "@/hooks/use-game";
import { usePlayback } from "@/hooks/use-playback";
import { Attachment } from "./attachment";
import { Modal } from "./dialog";

function timeLabel(seconds: number) {
  return `${Math.floor(Math.max(0, seconds) / 60).toString().padStart(2, "0")}:${Math.floor(Math.max(0, seconds) % 60).toString().padStart(2, "0")}`;
}

function LogEntry({ message, partial, openImage }: { message: Message; partial?: string; openImage: (id: string) => void }) {
  const system = message.speaker === "SYSTEM";
  return <article className={`log-entry speaker-${message.speaker.toLowerCase()} ${message.effect ?? ""}`} aria-hidden={partial !== undefined ? true : undefined}>
    <div className="log-meta"><span className="speaker">{system ? "[ SYSTEM ]" : message.speaker}</span><span className="log-rule" /><time>{timeLabel(message.remaining)}</time></div>
    <p>{message.speaker === "YOU" && <span className="prompt-arrow" aria-hidden="true">&gt; </span>}{partial ?? message.text}{partial !== undefined && <span className="typing-cursor" aria-hidden="true" />}</p>
    {message.imageId && partial === undefined && <Attachment id={message.imageId} onOpen={openImage} />}
  </article>;
}

export function Terminal() {
  const { game, ready, saveWarning, seen, remember, connecting, connect, act, reset, generation } = useGame();
  const [keyword, setKeyword] = useState("");
  const [skipRead, setSkipRead] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [panel, setPanel] = useState<"memory" | "help" | "reset" | null>(null);
  const [imageId, setImageId] = useState<string | null>(null);
  const [away, setAway] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [blackout, setBlackout] = useState(false);
  const [dismissedDisconnect, setDismissedDisconnect] = useState<string | null>(null);
  const sessionKey = `${generation}:${game.loopCount}`;
  const { count, chars, current, busy, skip } = usePlayback(game.messages, sessionKey, seen, remember, skipRead, reduced);
  const station = useRef<HTMLElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  const follow = useRef(true);
  const lastLoop = useRef(sessionKey);
  const complete = !busy && game.status === "ending";
  const lost = game.status === "disconnected";
  const showDisconnect = lost && dismissedDisconnect !== sessionKey && !connecting;
  const choices = getChoices(game);
  const active = game.status === "playing" && !connecting;
  const hasUnknown = game.messages.slice(0, count).some((message) => message.speaker === "UNKNOWN");
  const quiet = current?.effect === "quiet";
  const tier = active && !game.containmentReleased ? game.remaining <= 10 ? "critical" : game.remaining <= 30 ? "danger" : game.remaining <= 60 ? "warning" : "normal" : "normal";

  useEffect(() => {
    // A timeout can remove the input before the browser emits compositionend.
    composing.current = false;
  }, [active, sessionKey]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(media.matches);
    queueMicrotask(onChange);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const syncViewport = () => {
      if (viewport.scale !== 1) return;
      station.current?.style.setProperty("--viewport-height", `${viewport.height}px`);
      if (station.current) station.current.dataset.compact = String(viewport.height < 500);
      if (follow.current && log.current) log.current.scrollTop = log.current.scrollHeight;
    };
    syncViewport();
    viewport.addEventListener("resize", syncViewport);
    return () => viewport.removeEventListener("resize", syncViewport);
  }, []);

  useEffect(() => {
    if (follow.current && log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [count, chars, complete, lost]);

  useEffect(() => {
    if (lastLoop.current !== sessionKey) {
      follow.current = true;
      lastLoop.current = sessionKey;
      queueMicrotask(() => { setAway(false); setKeyword(""); });
    }
  }, [sessionKey]);

  useEffect(() => {
    if (game.status !== "disconnected") {
      const clear = setTimeout(() => setBlackout(false), 0);
      return () => clearTimeout(clear);
    }
    const start = setTimeout(() => setBlackout(true), 350);
    const finish = setTimeout(() => setBlackout(false), 1100);
    return () => { clearTimeout(start); clearTimeout(finish); };
  }, [game.status]);

  useEffect(() => {
    const start = setTimeout(() => setPulse(current?.effect === "glitch" && !reduced), 0);
    const finish = setTimeout(() => setPulse(false), 350);
    return () => { clearTimeout(start); clearTimeout(finish); };
  }, [current?.id, current?.effect, reduced]);

  const submit = (value: string, isKeyword = false) => {
    if (busy || !active || composing.current || !value.trim()) return;
    follow.current = true;
    setAway(false);
    act(value, isKeyword);
    if (isKeyword) setKeyword("");
  };

  const openImage = (id: string) => setImageId(id);
  const dismissDisconnect = () => {
    setDismissedDisconnect(sessionKey); setPanel(null); setImageId(null);
    setTimeout(() => log.current?.focus({ preventScroll: true }), 0);
  };
  const reconnectNow = () => { skip(); follow.current = true; setPanel(null); setImageId(null); connect(); };

  return <main ref={station} className={`station ${reduced ? "reduced-motion" : ""}`}>
    <section className={`terminal tier-${tier} ${pulse && !quiet ? "event-glitch" : ""} ${quiet ? "quiet-scene" : ""}`} aria-label="ABYSSAL-7 非常通信端末">
      <div className="screen-texture" aria-hidden="true" />
      <header className="terminal-header">
        <div className="brand">
          <h1>ABYSSAL-7</h1>
          <p><span className={`status-dot ${active ? "live" : ""}`} aria-hidden="true" />
            {game.status === "idle" ? "非常通信端末" : lost ? "通信切断" : complete ? "通信終了" : `回線 ${hasUnknown ? "07" : "AUX-07"}`}
          </p>
        </div>
        <nav className="terminal-menu" aria-label="端末メニュー">
          <button className="menu-button" aria-haspopup="dialog" onClick={() => setPanel("help")}><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" /><path d="M8 7.5a2 2 0 0 1 4 0c0 1.5-2 1.5-2 3M10 13.5v.1" /></svg>操作案内</button>
          <button className="menu-button memory-button" aria-haspopup="dialog" onClick={() => setPanel("memory")}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 3.5h10v13H5zM8 7h4M8 10h4M8 13h2" /></svg>記録 <span>{String(game.knownFacts.length).padStart(2, "0")}</span></button>
        </nav>
        <div className="clock-block">
          <span className="clock-caption">{game.containmentReleased ? "通信終了" : tier === "critical" ? "通信限界" : "残り時間"}</span>
          <span className="timer" role="timer" aria-label={`通信残り時間 ${timeLabel(game.remaining)}`}>{timeLabel(game.remaining)}</span>
        </div>
      </header>

      {game.status === "idle" ? <div className="standby">
        <div className="intro-content">
          <div className="intro-copy">
            <h2>水槽<span>07</span></h2>
            <div className="world-intro">
              <p>2089年、日本海溝の深度3,200m。<br />未知の生物を研究する海底施設「ABYSSAL-7」で、事故が起きた。</p>
              <p>地上の端末を開いたあなたに、<br className="desktop-break" />取り残された研究員・ユナから通信が届く。</p>
              <p className="intro-stakes">回線がもつのは、<strong>3分。</strong><br />途切れても、得た情報を手がかりに、もう一度。</p>
            </div>
            <section className="start-controls" aria-label="通信操作" aria-busy={connecting}>
              <button className="primary-button" disabled={!ready || connecting} onClick={connect}>
                {connecting ? "接続中…" : game.loopCount > 1 ? "記録から再接続" : "接続を開始"}<span aria-hidden="true">↗</span>
              </button>
              <p>選択肢と言葉で、ユナを導いてください。</p>
            </section>
          </div>
          <div className="tank-symbol" aria-hidden="true"><i /><i /><i /><i /><div className="tank-water" /><div className="tank-reflection" /></div>
        </div>
      </div> : <>
        <div className="transcript-panel">
          <div className="log-area" ref={log} role="log" aria-label="通信ログ" aria-live="polite" aria-relevant="additions" tabIndex={0} onScroll={() => {
            const node = log.current;
            if (!node) return;
            const isAway = node.scrollHeight - node.scrollTop - node.clientHeight > 70;
            follow.current = !isAway;
            setAway(isAway);
          }}>
            <div className="log-content">
              {game.messages.slice(0, count).map((message) => <LogEntry key={message.id} message={message} openImage={openImage} />)}
              {current && chars >= 0 && <LogEntry message={current} partial={current.text.slice(0, chars)} openImage={openImage} />}
              {current && chars < 0 && current.speaker !== "SYSTEM" && current.speaker !== "YOU" && <div className="transmitting" aria-hidden="true"><span className="transmission-dots">···</span>{current.speaker} 受信中…</div>}
              {complete && <div className="ending-report">
                <h2>{game.ending === "true" ? "水槽07" : "ABYSSAL-7 INCIDENT"}</h2>
                <div className="report-fields">
                  {game.ending === "normal" ? <><span>SURVIVORS <b>1</b></span><span>CAUSE <b>UNKNOWN</b></span></>
                  : game.ending === "true" ? <><span>CONNECTION HISTORY <b>ERROR</b></span><span>LOOP COUNT <b>UNKNOWN</b></span></>
                  : <><span>VISITOR <b>RECOGNIZED</b></span><span>CONNECTION <b>REPEATED</b></span></>}
                </div>
                <span className="ending-type">{game.ending?.toUpperCase()} END</span>
              </div>}
            </div>
          </div>
          {away && <button className="jump-latest" onClick={() => {
            follow.current = true;
            setAway(false);
            if (log.current) log.current.scrollTop = log.current.scrollHeight;
          }}>最新の通信へ ↓</button>}
        </div>
        <section className="command-deck" aria-label="通信操作" aria-busy={busy || connecting}>
          <div className="command-content">
            {lost ? <div className="disconnect-controls">
              <p>通信は途絶えた。記録は残っている。</p>
              {!showDisconnect && <button className="primary-button" onClick={reconnectNow} disabled={connecting}>{connecting ? "再接続中…" : "再接続する"}<span aria-hidden="true">↻</span></button>}
            </div> : complete ? <div className="disconnect-controls">
              <p>記録を持って、もう一度。</p>
              <button className="primary-button" onClick={reconnectNow} disabled={connecting}>もう一度接続する<span aria-hidden="true">↻</span></button>
            </div> : <>
              <div className="choices" aria-label="応答の選択肢">
                {choices.map((choice, index) => <button key={choice.id} className={choice.fromRecord ? "record-choice" : undefined} disabled={busy || !active} onClick={() => submit(choice.id)}>
                  <span className="choice-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <span className="choice-label">{choice.fromRecord && <span className="record-tag">記録より</span>}{choice.label}</span>
                  <span className="choice-cost" aria-label={`所要${choice.cost}秒`}>{choice.cost ? `−${choice.cost}s` : "↵"}</span>
                </button>)}
              </div>
              <form className="keyword-form" onSubmit={(event) => { event.preventDefault(); submit(keyword, true); }}>
                <label htmlFor="keyword" className="sr-only">キーワード</label>
                <span className="input-prompt" aria-hidden="true">&gt;</span>
                <input id="keyword" ref={input} value={keyword} onChange={(event) => setKeyword(event.target.value)}
                  onCompositionStart={() => { composing.current = true; }}
                  onCompositionEnd={() => { composing.current = false; }}
                  onKeyDown={(event) => { if (event.key === "Enter" && (composing.current || event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault(); }}
                  placeholder="言葉・コードを入力" maxLength={120} autoComplete="off" autoCapitalize="off" spellCheck={false} list="known-keywords" disabled={!active} />
                <button type="submit" disabled={busy || !active || !keyword.trim()} aria-label="キーワードを送信">送信 <span aria-hidden="true">↵</span></button>
              </form>
              <datalist id="known-keywords">{game.knownFacts.flatMap((id) => FACTS[id]?.keyword ? [<option key={id} value={FACTS[id].keyword}>{FACTS[id].title}</option>] : [])}</datalist>
              <div className="playback-controls">
                {busy ? <button className="text-button skip-button" onClick={skip}>受信を早送り ≫</button>
                : <label className="skip-setting"><input type="checkbox" checked={skipRead} onChange={(event) => setSkipRead(event.target.checked)} />既読を省略</label>}
              </div>
            </>}
          </div>
        </section>
      </>}
      {saveWarning && <p className="save-warning" role="status">このブラウザでは記録を保存できません。</p>}
      {connecting && <div className="connection-overlay" role="status"><div className="connection-reticle" aria-hidden="true">+</div><p>接続中<span className="blink">_</span></p></div>}
      {blackout && !connecting && <div className="blackout" aria-hidden="true"><span>SIGNAL LOST</span></div>}
    </section>

    {showDisconnect && <Modal key={`disconnect-${sessionKey}`} title="通信が途絶えました" className="disconnect-modal" showClose={false} onClose={dismissDisconnect}>
      <div className="lost-signal" aria-hidden="true"><svg viewBox="0 0 240 40"><path d="M0 20h60l8-9 9 19 10-24 9 28 8-14h17m28 0h91" /><path className="signal-break" d="m121 10 15 20m0-20-15 20" /></svg><span>SIGNAL LOST</span></div>
      <p>取得した記録を持って、<br />もう一度接続できます。</p>
      <button autoFocus className="primary-button" onClick={reconnectNow}>再接続する<span aria-hidden="true">↻</span></button>
      <button className="text-button review-log" onClick={dismissDisconnect}>通信ログを見返す</button>
    </Modal>}
    {!showDisconnect && panel === "memory" && <Modal title="記録" onClose={() => setPanel(null)}>
      {game.knownFacts.length === 0 ? <div className="empty-memory"><p>受信した情報が、ここに残ります。</p></div>
      : <div className="memory-list">{game.knownFacts.map((id) => FACTS[id] && <article key={id}>
        <span className="micro-label">{FACTS[id].category}</span>
        <h3>{FACTS[id].title}</h3><p>{FACTS[id].detail}</p>
        {FACTS[id].keyword && <button className="memory-keyword" disabled={!active || busy} onClick={() => {
          setKeyword(FACTS[id].keyword ?? ""); setPanel(null); setTimeout(() => input.current?.focus(), 0);
        }}>入力欄へ：{FACTS[id].keyword} ↗</button>}
      </article>)}</div>}
      {active && <p className="panel-note">記録を開いている間も時間は進みます。</p>}
    </Modal>}
    {!showDisconnect && panel === "help" && <Modal title="操作案内" onClose={() => setPanel(null)}>
      <div className="manual">
        <dl>
          <dt>選ぶ、または入力する</dt>
          <dd>選択肢を押すか、場所・コード・行動を入力して送信。画像は押すと拡大できます。</dd>
          <dt>1回の通信は3分</dt>
          <dd>実時間と行動の所要時間で残り時間が減ります。記録や映像を開いている間も進みます。</dd>
          <dt>知っていることは、次の通信でも</dt>
          <dd>情報が揃うと「記録より」と付いた選択肢が現れます。正解を知っていれば、未取得でも直接入力で進めます。</dd>
        </dl>
        <div className="display-settings"><span>画面の動き</span><button className="setting-button" aria-pressed={reduced} onClick={() => setReduced(!reduced)}>演出 {reduced ? "控えめ" : "標準"}</button></div>
        <button className="danger-button" onClick={() => setPanel("reset")}>記録を消して最初から</button>
      </div>
    </Modal>}
    {!showDisconnect && panel === "reset" && <Modal title="記録を消去" onClose={() => setPanel(null)}>
      <p>取得した情報と接続履歴を、このブラウザから消去します。</p>
      <div className="dialog-actions"><button className="text-button" onClick={() => setPanel(null)}>戻る</button><button className="danger-button" onClick={() => { reset(); setPanel(null); }}>消去して最初から</button></div>
    </Modal>}
    {!showDisconnect && imageId && IMAGES[imageId] && <Modal title={IMAGES[imageId].title} className="image-modal" onClose={() => setImageId(null)}>
      <Attachment id={imageId} expanded />
      {active && <p className="panel-note">映像を開いている間も時間は進みます。</p>}
    </Modal>}
  </main>;
}
