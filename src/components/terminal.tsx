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

function Signal({ lost = false }: { lost?: boolean }) {
  return <span className={`signal-bars ${lost ? "lost" : ""}`} aria-hidden="true"><i /><i /><i /><i /><i /></span>;
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
  const sessionKey = `${generation}:${game.loopCount}`;
  const { count, chars, current, busy, skip } = usePlayback(game.messages, sessionKey, seen, remember, skipRead, reduced);
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const follow = useRef(true);
  const lastLoop = useRef(sessionKey);
  const complete = !busy && game.status === "ending";
  const lost = game.status === "disconnected";
  const choices = getChoices(game);
  const active = game.status === "playing" && !connecting;
  const hasUnknown = game.messages.slice(0, count).some((message) => message.speaker === "UNKNOWN");
  const quiet = current?.effect === "quiet";
  const tier = active && !game.containmentReleased ? game.remaining <= 10 ? "critical" : game.remaining <= 30 ? "danger" : game.remaining <= 60 ? "warning" : "normal" : "normal";

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(media.matches);
    queueMicrotask(onChange);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
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
    if (busy || !active || !value.trim()) return;
    follow.current = true;
    setAway(false);
    act(value, isKeyword);
    if (isKeyword) setKeyword("");
  };

  const openImage = (id: string) => setImageId(id);
  const reconnectNow = () => { skip(); follow.current = true; connect(); };

  return <main className={`station ${reduced ? "reduced-motion" : ""}`}>
    <div className="station-caption"><span>DEEP SEA RESEARCH NETWORK</span><span>2089 / JP-TRENCH</span></div>
    <section className={`terminal tier-${tier} ${pulse && !quiet ? "event-glitch" : ""} ${quiet ? "quiet-scene" : ""}`} aria-label="ABYSSAL-7 非常通信端末">
      <div className="screen-texture" aria-hidden="true" />
      <header className="terminal-header">
        <div className="brand"><div className="brand-mark" aria-hidden="true">07<span /></div><div><h1>ABYSSAL-7</h1><p>EMERGENCY COMMUNICATION TERMINAL</p></div></div>
        <div className="clock-block"><span className="clock-caption">{game.containmentReleased ? "LINK CLOSED" : "LINK REMAINING"}</span><span className="timer" role="timer" aria-label={`通信残り時間 ${timeLabel(game.remaining)}`}>{timeLabel(game.remaining)}</span></div>
      </header>
      <div className="telemetry"><div className="coordinates"><span>DEPTH <b>3,200<span className="unit">m</span></b></span><span>CHANNEL <b>{hasUnknown ? "07" : "AUX-07"}</b></span></div><span className="signal"><Signal lost={lost || game.status === "idle"} /> <span>SIGNAL <b>{lost ? "00" : game.status === "idle" ? "--" : tier === "critical" ? "12" : tier === "danger" ? "28" : "63"}%</b></span></span></div>
      <div className="log-toolbar"><div className="log-title"><span className={`status-dot ${active ? "live" : ""}`} /><span>{game.status === "idle" ? "STANDBY" : complete ? "ARCHIVE CLOSED" : lost ? "SIGNAL LOST" : "LIVE TRANSCRIPT"}</span></div><nav aria-label="端末メニュー"><button className="text-button" onClick={() => setPanel("help")}>操作案内</button><button className="text-button memory-button" onClick={() => setPanel("memory")}>記録 <span>{String(game.knownFacts.length).padStart(2, "0")}</span></button></nav></div>

      {game.status === "idle" ? <div className="standby">
        <div className="standby-top"><span className="micro-label">INCOMING SIGNAL / UNIDENTIFIED</span><span className="receiving-wave" aria-hidden="true">▁▂▁▃▆▃▁▂▅▂▁▂▁</span></div>
        <div className="title-composition"><div className="tank-symbol" aria-hidden="true"><span>07</span><i /><i /><i /><i /><div className="tank-water" /></div><div className="title-copy"><span className="eyebrow">A THREE-MINUTE COMMUNICATION</span><h2>水槽<span>07</span></h2><p className="title-description">深度3,200m。<br />残された回線は、あと3分。</p></div></div>
        <div className="incoming"><span className="incoming-cross" aria-hidden="true">+</span><div><span className="micro-label">AUXILIARY CHANNEL DETECTED</span><p>海底研究施設から、応答を求める信号。</p></div></div>
        <div className="standby-foot"><span>TEXT COMMUNICATION ONLY</span><span>EST. 12–20 MIN</span></div>
      </div> : <div className="log-area" ref={log} role="log" aria-label="通信ログ" aria-live="polite" aria-relevant="additions" tabIndex={0} onScroll={() => { const node = log.current; if (!node) return; const isAway = node.scrollHeight - node.scrollTop - node.clientHeight > 70; follow.current = !isAway; setAway(isAway); }}>
        <div className="transcript-start"><span>BEGIN TRANSMISSION</span><span>AUX / 07</span></div>
        {game.messages.slice(0, count).map((message) => <LogEntry key={message.id} message={message} openImage={openImage} />)}
        {current && chars >= 0 && <LogEntry message={current} partial={current.text.slice(0, chars)} openImage={openImage} />}
        {current && chars < 0 && current.speaker !== "SYSTEM" && current.speaker !== "YOU" && <div className={`transmitting ${quiet ? "quiet" : ""}`} aria-hidden="true"><span className="transmission-dots">···</span> {current.speaker} IS TRANSMITTING{quiet ? " / CONNECTION DELAY" : "..."}</div>}
        {complete && <div className="ending-report"><span className="eyebrow">TRANSMISSION ARCHIVED</span><h2>{game.ending === "true" ? "水槽07" : "ABYSSAL-7 INCIDENT"}</h2><div className="report-fields">{game.ending === "normal" ? <><span>SURVIVORS <b>1</b></span><span>CAUSE <b>UNKNOWN</b></span></> : game.ending === "true" ? <><span>CONNECTION HISTORY <b>ERROR</b></span><span>LOOP COUNT <b>UNKNOWN</b></span></> : <><span>VISITOR <b>RECOGNIZED</b></span><span>CONNECTION <b>REPEATED</b></span></>}</div><span className="ending-type">{game.ending?.toUpperCase()} END</span></div>}
        <div className="log-bottom" />
      </div>}

      {away && <button className="jump-latest" onClick={() => { follow.current = true; setAway(false); if (log.current) log.current.scrollTop = log.current.scrollHeight; }}>最新の通信へ ↓</button>}
      <section className="command-deck" aria-label="通信操作">
        {game.status === "idle" ? <div className="start-controls"><div><p>{game.loopCount > 1 ? "地上側の記録が残っています。" : "あなたの言葉だけが、向こうへ届く。"}</p><span>{game.loopCount > 1 ? "施設の状態は、接続のたびに戻ります。" : "選択肢とキーワードで応答してください。"}</span></div><button className="primary-button" disabled={!ready || connecting} onClick={connect}>{connecting ? "接続中…" : game.loopCount > 1 ? "記録から再接続" : "接続を開始"}<span aria-hidden="true">↗</span></button></div>
        : lost ? <div className="disconnect-controls"><div><span className="micro-label">CONNECTION TERMINATED</span><p>通信は途絶えた。記録は、ここに残っている。</p></div><button className="primary-button" onClick={reconnectNow} disabled={connecting}>{connecting ? "再接続中…" : "再接続する"}<span aria-hidden="true">↻</span></button></div>
        : complete ? <div className="disconnect-controls"><div><span className="micro-label">END OF TRANSMISSION</span><p>記録を持って、もう一度。</p></div><button className="primary-button" onClick={reconnectNow} disabled={connecting}>もう一度接続する<span aria-hidden="true">↻</span></button></div>
        : <>
          <div className="command-heading"><span><span className="command-square" aria-hidden="true">■</span> {busy ? "RECEIVING TRANSMISSION" : "SELECT RESPONSE"}</span><span>{tier === "critical" ? "SYSTEM ALERT" : "行動に応じて時間が経過"}</span></div>
          <div className="choices" aria-label="応答の選択肢">{choices.map((choice, index) => <button key={choice.id} disabled={busy || !active} onClick={() => submit(choice.id)}><span className="choice-number">{String(index + 1).padStart(2, "0")}</span><span className="choice-label">{choice.label}</span><span className="choice-cost">{choice.cost ? `−${choice.cost}s` : "↵"}</span></button>)}</div>
          <form className="keyword-form" onSubmit={(event) => { event.preventDefault(); submit(keyword, true); }}><label htmlFor="keyword">KEYWORD <span aria-hidden="true">&gt;</span></label><input id="keyword" ref={input} value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="言葉・コードを入力" maxLength={120} autoComplete="off" autoCapitalize="off" spellCheck={false} list="known-keywords" aria-describedby="keyword-hint" disabled={!active} /><button type="submit" disabled={busy || !active || !keyword.trim()} aria-label="キーワードを送信">SEND <span aria-hidden="true">↵</span></button></form>
          <datalist id="known-keywords">{game.knownFacts.flatMap((id) => FACTS[id]?.keyword ? [<option key={id} value={FACTS[id].keyword}>{FACTS[id].title}</option>] : [])}</datalist>
          <div className="input-foot"><span id="keyword-hint">知っている言葉は、いつでも入力できる。</span>{busy ? <button className="text-button skip-button" onClick={skip}>受信を早送り ≫</button> : <label className="skip-setting"><input type="checkbox" checked={skipRead} onChange={(event) => setSkipRead(event.target.checked)} />既読を省略</label>}</div>
        </>}
      </section>
      <footer className="terminal-footer"><span role={saveWarning ? "status" : undefined}><span className="footer-square" aria-hidden="true">▪</span> {saveWarning ? "記録の端末保存を利用できません" : tier === "critical" ? "SIGNAL INSTABILITY DETECTED" : lost ? "AWAITING RECONNECTION" : "ENCRYPTED / LOCAL MEMORY"}</span><button className="text-button" aria-pressed={reduced} onClick={() => setReduced(!reduced)}>演出 {reduced ? "控えめ" : "標準"}</button></footer>
      {connecting && <div className="connection-overlay" role="status"><div className="connection-reticle" aria-hidden="true">+</div><p>RECONNECTING<span className="blink">_</span></p><span>AUX CHANNEL 07</span><span>SEARCHING... SIGNAL FOUND</span></div>}
      {blackout && !connecting && <div className="blackout" aria-hidden="true"><span>SIGNAL LOST</span></div>}
    </section>
    <div className="station-bottom"><span>ABYSSAL RESEARCH DIVISION</span><span>{saveWarning ? "記録の端末保存を利用できません" : "旧型保守回線 / 地上側端末"}</span></div>
    {panel === "memory" && <Modal title="LOCAL MEMORY / 地上側の記録" onClose={() => setPanel(null)}><p className="panel-intro">この端末に残された情報。施設の向こうへは、記憶だけを持っていく。</p>{game.knownFacts.length === 0 ? <div className="empty-memory"><span>NO RECORDS</span><p>受信した情報は、ここに記録されます。</p></div> : <div className="memory-list">{game.knownFacts.map((id) => FACTS[id] && <article key={id}><span className="micro-label">{id} / {FACTS[id].category}</span><h3>{FACTS[id].title}</h3><p>{FACTS[id].detail}</p>{FACTS[id].keyword && <button className="memory-keyword" disabled={!active || busy} onClick={() => { setKeyword(FACTS[id].keyword ?? ""); setPanel(null); setTimeout(() => input.current?.focus(), 0); }}>入力欄へ：{FACTS[id].keyword} ↗</button>}</article>)}</div>}<p className="panel-note">接続中は、記録を開いていても時間が進みます。</p></Modal>}
    {panel === "help" && <Modal title="OPERATOR MANUAL / 操作案内" onClose={() => setPanel(null)}><div className="manual"><p>海底施設の研究員から届く通信に、選択肢や言葉で応答してください。</p><dl><dt>通信できるのは、180秒。</dt><dd>実時間と行動の所要時間で残り時間が減ります。回線が途切れたら、再接続してください。</dd><dt>持ち越せるのは、記憶。</dt><dd>取得情報は「記録」に残ります。未取得でも、正しい言葉や手順を知っていれば使えます。</dd><dt>キーワードは自由に。</dt><dd>場所、コード、調べたいこと、行動の指示を入力できます。Enter キーでも送信できます。</dd><dt>映像と通信を読む。</dt><dd>画像は押すと拡大します。「受信を早送り」で文章を即時表示。「既読を省略」は再接続後の同じ文章を短縮します。</dd></dl><p className="panel-note">記録・映像を開いている間も時間は進みます。再読み込みすると、取得情報を残して新しい接続から始まります。音声はありません。</p><button className="danger-button" onClick={() => setPanel("reset")}>記録を消して最初から</button></div></Modal>}
    {panel === "reset" && <Modal title="RESET LOCAL MEMORY" onClose={() => setPanel(null)}><p>取得した情報と接続履歴を、このブラウザから消去します。</p><div className="dialog-actions"><button className="text-button" onClick={() => setPanel(null)}>戻る</button><button className="danger-button" onClick={() => { reset(); setPanel(null); }}>消去して最初から</button></div></Modal>}
    {imageId && IMAGES[imageId] && <Modal title={`${imageId} / ${IMAGES[imageId].title}`} className="image-modal" onClose={() => setImageId(null)}><Attachment id={imageId} expanded /><p className="panel-note">受信映像 / {IMAGES[imageId].camera} — 接続中は時間が進みます。</p></Modal>}
  </main>;
}
