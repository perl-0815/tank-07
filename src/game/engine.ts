import { ACTIONS, ACTION_TOPICS, CHOICE_CONTEXTS, CHOICE_GROUPS, CHOICE_RECORDS, KEYWORDS, LOOP_SECONDS, SCRIPT, SCRIPT_TOPICS, TRUE_FACTS } from "./scenario.ts";
import type { Choice, DialogueTopic, GameState, ScriptLine } from "./types.ts";

export type { Choice, GameState, Message, Ending } from "./types.ts";

export function createGame(): GameState {
  return {
    status: "idle", scene: "intro", loopCount: 1, remaining: LOOP_SECONDS,
    knownFacts: [], trustYuna: 0, powerEnabled: false, drainageDisabled: false,
    containmentReleased: false, watchedTankLog: false, watchedSecurityLog: false,
    questionedYunaIdentity: false, messages: [], ending: null, location: "section4",
    nextMessageId: 1, triggeredEvents: [], escapeTrapAt: null,
    pressureFailureAt: null, doomed: null, hasPumpClue: false, truthClosed: false,
    sharedFacts: [], sharedTopics: [], completedActions: [], centralAccessed: false,
    protocolInspected: false, pressureInspected: false, commsInspected: false,
    usedForeknowledge: false,
  };
}

function append(state: GameState, lines: ScriptLine[]): GameState {
  return {
    ...state,
    messages: [...state.messages, ...lines.map((line, index) => ({
      ...line, id: `${state.loopCount}-${state.nextMessageId + index}`, remaining: state.remaining,
    }))],
    nextMessageId: state.nextMessageId + lines.length,
  };
}

function script(state: GameState, key: string): GameState {
  return shareTopics(append(state, SCRIPT[key] ?? []), SCRIPT_TOPICS[key] ?? []);
}

function shareTopics(state: GameState, topics: DialogueTopic[]): GameState {
  if (!topics.length) return state;
  return { ...state, sharedTopics: [...new Set([...state.sharedTopics, ...topics])] };
}

function actionTopics(state: GameState, key: string): GameState {
  return shareTopics(state, ACTION_TOPICS[key] ?? []);
}

function reply(state: GameState, text: string, speaker: ScriptLine["speaker"] = "YUNA", imageId?: string): GameState {
  return append(state, [{ speaker, text, ...(imageId ? { imageId } : {}) }]);
}

/** Persistent observer memory and this connection's shared context are distinct. */
function facts(state: GameState, ids: string[]): GameState {
  return {
    ...state,
    knownFacts: [...new Set([...state.knownFacts, ...ids])],
    sharedFacts: [...new Set([...state.sharedFacts, ...ids])],
  };
}

function completed(state: GameState, id: string): GameState {
  return actionTopics({ ...state, completedActions: [...new Set([...state.completedActions, id])] }, id);
}

export function startGame(state: GameState): GameState {
  if (state.status !== "idle") return state;
  return script({ ...state, status: "playing", scene: "intro" }, "opening");
}

export function reconnect(state: GameState): GameState {
  if (state.status !== "disconnected" && state.status !== "ending") return state;
  const next = {
    ...createGame(), loopCount: state.loopCount + 1,
    knownFacts: [...state.knownFacts], hasPumpClue: state.hasPumpClue,
  };
  return startGame(script(next, "reconnect"));
}

function disconnect(state: GameState, reason: string): GameState {
  return script({ ...state, status: "disconnected", scene: "disconnected" }, reason);
}

/** Chronological, once-only events. No event is scheduled beyond the deadline. */
export function advanceTime(state: GameState, seconds: number): GameState {
  if (state.status !== "playing" || state.scene === "unknown" || !Number.isFinite(seconds) || seconds <= 0) return state;
  const target = Math.max(0, state.remaining - seconds);
  const events: { at: number; key: string }[] = [
    { at: 120, key: "flood" }, { at: 60, key: "minute" },
    { at: 30, key: "thirty" }, { at: 10, key: "ten" }, { at: 0, key: "timeout" },
  ];
  if (state.escapeTrapAt !== null && state.escapeTrapAt > 0) events.push({ at: state.escapeTrapAt, key: "escapeFailure" });
  if (state.pressureFailureAt !== null && state.pressureFailureAt > 0) events.push({ at: state.pressureFailureAt, key: "pressureFailure" });
  events.sort((a, b) => b.at - a.at);
  let next = state;
  for (const event of events) {
    if (event.at > state.remaining || event.at < target || next.triggeredEvents.includes(event.key)) continue;
    next = { ...next, remaining: event.at, triggeredEvents: [...next.triggeredEvents, event.key] };
    if (event.key === "escapeFailure") return disconnect(facts(next, ["F04"]), event.key);
    if (event.key === "pressureFailure") return disconnect(facts({ ...next, hasPumpClue: true }, ["F05"]), event.key);
    if (event.key === "timeout") return disconnect(next, event.key);
    let eventScript = event.key;
    if (event.key === "flood" && next.location !== "section4") eventScript = next.location === "passage" ? "floodTransit" : "floodRemote";
    if (event.key === "thirty") {
      eventScript = next.drainageDisabled ? "thirtyDrained"
        : next.centralAccessed ? "thirtyCentral"
          : next.powerEnabled ? "thirtyPowered"
            : next.location === "machine" ? "thirtyMachine" : "thirty";
      next = facts(next, ["F02"]);
    }
    next = script(next, eventScript);
  }
  return { ...next, remaining: target };
}

const POWER_REQUIRED = new Set([
  "open_door", "inspect_controls", "tank", "vitals", "brighten", "audio", "security", "next_security",
  "central", "protocol", "pressure", "pressure_details", "stop_pump", "comms", "history",
  "signal", "maintain", "reinforce", "request_release", "release", "refuse", "alternative",
]);
const TRUTH_ACTIONS = new Set(["question_identity", "audio", "security", "next_security"]);
const NAVIGATION_ONLY = new Set(["more", "back"]);
const REPEAT_RESPONSES: Record<string, string> = {
  hello: "聞こえてる。回線はまだ繋がってるよ。次の指示を送って",
  name: "神崎ユナ。生物研究員だよ。今はここから出る方法を考えたい",
  incident_intro: "水槽07の警報と停電から始まった。分かっているのは、さっき話したことだけ",
  incident: "最初に水槽07の警報が鳴って、電源が落ちた。原因はまだ分からない",
  find_code: "コードは、さっきパネルで確認した7319だよ",
  inspect_controls: "中央管理端末から隔離を操作できる。さっき調べた設備一覧のとおりだよ",
  tank: "水槽07の映像は開いてある。生体反応や音声ログも調べられる",
  vitals: "生体反応は、今もゼロのまま",
  brighten: "映像の明るさは、もう上げてある。はっきりとは見えない",
  audio: "さっきの音声ログは、私の声を繰り返していた。言葉を学習していたみたい",
  security: "17分前の映像は確認した。私に見えるけれど、入った覚えがない",
  next_security: "5分前の映像でも、私は応答していなかった。そこから映像が途切れている",
  question_identity: "私にも、自分がここにいる理由は分からない。さっき話した以上のことは……",
  reassure: "うん、聞いてる。次に何をするか教えて",
  central: "機械室から中央管理端末へ、もう遠隔接続してある",
  protocol: "隔離はまだ有効。状態は変わっていない",
  comms: "通信回線の診断画面は開いてある。履歴と発信元を確認できる",
  history: "施設の時計は進み続けている。この回線の記録だけ、同じ時間を繰り返してる",
  signal: "発信元は変わらない。保守回線に、水槽側の信号が混じってる",
};

function timedReply(state: GameState, text: string, seconds = 3): GameState {
  const next = advanceTime(state, seconds);
  return next.status === "playing" ? reply(next, text) : next;
}

function travelToMachine(state: GameState, departure: string): GameState {
  let next = script(state, departure);
  next = advanceTime({ ...next, location: "passage" }, 25);
  if (next.status !== "playing") return next;
  next = completed(facts({ ...next, location: "machine", scene: "machine" }, ["F02"]), "go_machine");
  return script(next, "machineArrival");
}

function requestRelease(state: GameState): GameState {
  let next = advanceTime(state, ACTIONS.request_release.cost);
  if (next.status !== "playing") return next;
  next = script(facts({ ...next, scene: "release_confirm", centralAccessed: true }, ["F04"]), "releaseWarning");
  if (!next.drainageDisabled) next = script(next, "pumpWarning");
  else next = reply(next, "先に第7区画の排水ポンプを止める手順は、もう済んでる。あとは開放の確認だけ");
  // Both warning variants explain the full procedure; preserve that discovery.
  return facts({ ...next, hasPumpClue: true }, ["F05"]);
}

function execute(state: GameState, actionId: string, input?: string): GameState {
  if (state.status !== "playing" || NAVIGATION_ONLY.has(actionId)) return state;
  const action = ACTIONS[actionId];
  if (!action || (state.scene === "unknown" && actionId !== "unknown_identity")) return state;
  let next = append(state, [{ speaker: "YOU", text: input ?? action.label }]);
  if (state.doomed && actionId !== "wait") return timedReply(next, "操作が受け付けられない。隔壁が――");
  if (POWER_REQUIRED.has(actionId) && !state.powerEnabled) {
    next = advanceTime(next, 3);
    return next.status === "playing" ? script(facts(next, ["F02"]), "noPower") : next;
  }
  if (TRUTH_ACTIONS.has(actionId) && state.truthClosed) {
    next = advanceTime(next, 3);
    return next.status === "playing" ? script(next, "truthClosed") : next;
  }
  if (actionId === "request_release" || (actionId === "release" && state.scene !== "release_confirm")) return requestRelease(next);
  if ((actionId === "refuse" || actionId === "alternative") && state.scene !== "release_confirm") {
    return timedReply(next, "今は解除の確認待ちではないよ。操作する設備を指定して");
  }
  // Repeating completed operations never replays first-time discovery or trust changes.
  if (actionId === "enable_power" && state.powerEnabled) return reply(next, "EMERGENCY POWER ALREADY ONLINE", "SYSTEM");
  if (actionId === "stop_pump" && state.drainageDisabled) return reply(next, "第7区画の排水ポンプは停止したまま。まだ動かしていないよ");
  if (actionId === "go_machine" && state.location === "machine") return reply(next, "もう第2機械室にいる。ここから操作を続けられる");
  if (actionId === "reassure" && state.completedActions.includes("reassure")) {
    next = advanceTime(next, action.cost);
    if (next.status !== "playing") return next;
    return reply({ ...next, trustYuna: Math.min(2, next.trustYuna + 1) }, "……急いでいても、ちゃんと話してくれるんだね。もう少し、あなたを信じてみる");
  }
  if ((state.completedActions.includes(actionId) || (actionId === "hello" && state.completedActions.length > 0)) && REPEAT_RESPONSES[actionId]) {
    return timedReply(next, REPEAT_RESPONSES[actionId], 2);
  }

  const sharedAtRequest = state.sharedFacts;
  if (actionId === "go_machine") {
    const anticipated = !sharedAtRequest.includes("F02");
    return travelToMachine({ ...next, usedForeknowledge: next.usedForeknowledge || anticipated }, anticipated ? "machineUnknown" : "machineKnown");
  }
  if (["enable_power", "find_code", "admin"].includes(actionId) && state.location !== "machine") {
    const anticipated = !sharedAtRequest.includes("F02") || (actionId === "enable_power" && !sharedAtRequest.includes("F03"));
    next = travelToMachine({ ...next, usedForeknowledge: next.usedForeknowledge || anticipated }, actionId === "enable_power" ? "codeFirst" : sharedAtRequest.includes("F02") ? "machineKnown" : "machineUnknown");
    if (next.status !== "playing") return next;
  }
  if (actionId === "find_code") next = reply(next, "保守用のパネルを外す。少し待って");
  if (actionId === "stop_pump") {
    if (state.pressureInspected || state.sharedFacts.includes("F05")) next = reply(next, "確認した保守手順どおり、先に第7区画の排水ポンプを止める");
    else next = append({ ...next, usedForeknowledge: true }, [{ speaker: "YUNA", text: "そんなことしたら水槽側の圧力が――" }, { speaker: "YOU", text: "止めて" }]);
  }
  if (actionId === "release") next = script(next, next.trustYuna >= 1 ? "releaseTrusted" : "releaseDistrust");
  if (actionId === "question_identity") next = append(next, [
    { speaker: "YOU", text: state.sharedFacts.includes("F13") ? "さっきの監視記録では、事故の5分前から君は応答してなかった" : "事故の5分前から君は応答してない" },
    { speaker: "SYSTEM", text: "TRANSMISSION DELAY / 5 SEC", effect: "quiet" },
  ]);

  // An action's results only commit if the operation finishes before the deadline.
  next = advanceTime(next, action.cost);
  if (next.status !== "playing") return next;
  const codeWasAnticipated = actionId === "enable_power" && !sharedAtRequest.includes("F03");
  next = completed({
    ...next, scene: action.scene ?? (next.scene === "intro" ? "contact" : next.scene),
    trustYuna: Math.max(-2, Math.min(2, next.trustYuna + (action.trust ?? 0) - (codeWasAnticipated ? 1 : 0))),
    usedForeknowledge: next.usedForeknowledge || codeWasAnticipated,
  }, actionId);
  next = facts(next, action.facts ?? []);
  if (action.lines && actionId !== "find_code" && !(next.drainageDisabled && ["maintain", "reinforce"].includes(actionId))) next = append(next, action.lines);

  switch (actionId) {
    case "hello": case "name": case "incident_intro":
      return state.completedActions.length === 0 ? script(next, "welcome") : next;
    case "location":
      if (next.location === "machine") return reply(next, "今は第2機械室。最初にいた第4研究区画から、保守通路を通って移動した", "YUNA", "IMG_03");
      return reply(actionTopics(facts(next, ["F01"]), "location_section4"), "第4研究区画。奥の扉は閉まったまま", "YUNA", "IMG_01");
    case "escape":
      return reply(actionTopics(next, next.powerEnabled ? "escape_powered" : "escape_unpowered"), next.powerEnabled ? "非常電源は戻った。第4区画の扉は遠隔で開けられるけど、中央の自動封鎖がまだ動いてる" : "扉がロックされてる。非常電源が戻れば開くと思う");
    case "tank_question":
      if (next.trustYuna >= 1) return script(next, "tankTrusted");
      return next.powerEnabled ? reply(next, "詳しい説明は後にして。電源は戻ったから、監視映像なら確認できる") : script(next, "tankDistrust");
    case "find_code":
      return reply(next, "あった。手書きの番号……7319。これが非常電源のコード");
    case "enable_power":
      return script(facts({ ...next, powerEnabled: true, location: "machine" }, ["F02"]), codeWasAnticipated ? "powerUnknown" : "powerKnown");
    case "open_door":
      return { ...next, location: "passage", doomed: "escape", escapeTrapAt: next.remaining > 20 ? next.remaining - 20 : null };
    case "tank": case "audio": case "brighten":
      return { ...next, scene: "tank", watchedTankLog: true };
    case "vitals":
      return { ...next, scene: "tank" };
    case "security": case "next_security":
      return { ...next, scene: "security", watchedSecurityLog: true };
    case "question_identity": {
      const seenTogether = state.sharedFacts.includes("F13");
      next = append({ ...next, questionedYunaIdentity: true, usedForeknowledge: next.usedForeknowledge || !seenTogether }, [
        { speaker: "YUNA", text: seenTogether ? "……私も、その記録を見た。でも、覚えていないの" : "……それ、誰から聞いたの？", effect: "quiet" },
      ]);
      return next.trustYuna >= 1 ? script(facts(next, ["F21"]), "identityHigh") : script({ ...next, truthClosed: true }, "identityLow");
    }
    case "reassure":
      return reply(next, next.powerEnabled || !next.sharedFacts.includes("F02") ? "……分かった。あなたを信じる" : "……分かった。非常電源を戻そう");
    case "central":
      return { ...next, centralAccessed: true };
    case "protocol":
      return { ...next, centralAccessed: true, protocolInspected: true };
    case "pressure": {
      next = reply({ ...next, centralAccessed: true, pressureInspected: true, hasPumpClue: true }, next.drainageDisabled
        ? "SECTION-07 / DRAINAGE PUMP: OFFLINE\nPRESSURE DIFFERENTIAL STABILIZING / CONTAINMENT STILL ACTIVE"
        : "SECTION-07 / DRAINAGE PUMP: ACTIVE\nCONTAINMENT PRESSURE: RISING", "SYSTEM");
      next = reply(next, "水槽07の隔離を解除すれば、自動封鎖も停止する");
      return reply(next, next.drainageDisabled ? "先に排水ポンプを止める手順は済んだ。でも隔離に残った圧力は、開放しないと逃がせない" : "保守手順に注意書きがある。『水槽07開放時は、先に第7区画排水ポンプを停止すること』");
    }
    case "pressure_details":
      next = reply({ ...next, centralAccessed: true, pressureInspected: true, hasPumpClue: true }, next.drainageDisabled ? "排水ポンプはもう止まった。でも隔離に閉じ込められた圧力は、まだ残ってる" : "排水と隔離が同時に動いて、圧力差が広がってる");
      return reply(next, "先にポンプを停止してから水槽07を開けば、残った圧力も、自動封鎖も止められる");
    case "stop_pump":
      next = reply({ ...next, drainageDisabled: true, hasPumpClue: true, centralAccessed: true }, "DRAINAGE OFFLINE\nSECTION-07 PRESSURE DIFFERENTIAL STABILIZING", "SYSTEM");
      return reply(next, "止まった。隔離解除の前に、確認が必要だね");
    case "comms": case "history": case "signal":
      return { ...next, centralAccessed: true, commsInspected: true };
    case "maintain": case "reinforce": case "refuse": case "alternative":
      if (state.drainageDisabled && ["maintain", "reinforce"].includes(actionId)) next = reply(next, "排水は止まっていても、隔離に残った圧力が逃げない。隔壁が――");
      return { ...next, doomed: "pressure", pressureFailureAt: next.remaining > 12 ? next.remaining - 12 : null };
    case "release": {
      next = facts({ ...next, containmentReleased: true }, ["F05"]);
      if (!next.drainageDisabled) return disconnect({ ...next, doomed: "order", hasPumpClue: true }, "orderFailure");
      next = script(facts(next, ["F22"]), "released");
      if (next.loopCount === 1) return script(facts({ ...next, status: "ending", scene: "ending", ending: "secret" }, ["F23"]), next.usedForeknowledge ? "secret" : "secretLearned");
      if (TRUE_FACTS.every((id) => next.knownFacts.includes(id))) return { ...next, scene: "unknown" };
      return script({ ...next, status: "ending", scene: "ending", ending: "normal" }, "normal");
    }
    case "unknown_identity":
      if (state.scene !== "unknown") return reply(next, "水槽からの通信……？　まだ回線が繋がっていない");
      return script(facts({ ...next, status: "ending", scene: "ending", ending: "true" }, ["F23"]), "true");
    default:
      return next;
  }
}

export function performAction(state: GameState, actionId: string): GameState {
  return execute(state, actionId);
}

export function normalizeKeyword(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/[\s。、,，.!！?？「」『』:：]/g, "");
}

export function submitKeyword(state: GameState, text: string): GameState {
  if (state.status !== "playing") return state;
  const input = text.trim().slice(0, 200);
  if (!input) return state;
  const normalized = normalizeKeyword(input);
  if (state.scene === "unknown" && !KEYWORDS.unknown_identity.some((alias) => normalizeKeyword(alias) === normalized)) {
    return append(state, [{ speaker: "YOU", text: input }, { speaker: "UNKNOWN", text: "聞いて。あなたが、知りたいことを", effect: "quiet" }]);
  }
  for (const [actionId, aliases] of Object.entries(KEYWORDS)) {
    if (aliases.some((alias) => normalizeKeyword(alias) === normalized)) return execute(state, actionId, input);
  }
  if (state.scene === "unknown") return append(state, [{ speaker: "YOU", text: input }, { speaker: "UNKNOWN", text: "聞いて。あなたが、知りたいことを", effect: "quiet" }]);
  let next = append(state, [{ speaker: "YOU", text: input }]);
  next = advanceTime(next, 3);
  if (next.status !== "playing") return next;
  const numeric = /^\d+$/.test(normalized);
  const hint = numeric
    ? next.powerEnabled ? "非常電源はもう動いているよ。その番号で別の操作をするなら、設備名も教えて" : "その番号は認証されない。機械室の保守パネルなら、コードが残っているかもしれない"
    : !next.powerEnabled ? "うまく聞き取れなかった。場所や設備の名前を送って。まずは非常電源を探したい"
      : "操作を確認したい。『監視ログ』『中央管理端末』『圧力制御』のように、設備や指示を送って";
  const topicKey = numeric ? next.powerEnabled ? "" : "wrong_code_unpowered" : next.powerEnabled ? "input_hint_powered" : "input_hint_unpowered";
  return reply(actionTopics(next, topicKey), hint);
}

/** Display eligibility only; execute and keyword parsing never consult it. */
function recordSupports(state: GameState, id: string): boolean {
  if (id === "stop_pump" && state.hasPumpClue) return true;
  return (CHOICE_RECORDS[id] ?? []).every((fact) => state.knownFacts.includes(fact));
}

/** Scene-independent conversational setup, separate from records and execution. */
function contextSupports(state: GameState, id: string): boolean {
  const rule = CHOICE_CONTEXTS[id];
  if (!rule) return false;
  return (!rule.allTopics || rule.allTopics.every((topic) => state.sharedTopics.includes(topic)))
    && (!rule.anyTopics || rule.anyTopics.some((topic) => state.sharedTopics.includes(topic)));
}

function physicallyAvailable(state: GameState, id: string): boolean {
  if (POWER_REQUIRED.has(id) && !state.powerEnabled) return false;
  if (TRUTH_ACTIONS.has(id) && state.truthClosed) return false;
  if (id === "go_machine") return !state.powerEnabled && state.location !== "machine";
  if (id === "enable_power" || id === "find_code" || id === "admin") return !state.powerEnabled && state.location === "machine";
  if (id === "stop_pump") return !state.drainageDisabled;
  if (id === "break_door") return !state.powerEnabled && state.location === "section4";
  if (id === "central") return !state.centralAccessed;
  if (["protocol", "pressure", "comms"].includes(id)) return state.centralAccessed;
  if (id === "maintain" || id === "reinforce") return state.protocolInspected;
  if (id === "history" || id === "signal") return state.commsInspected;
  if (["vitals", "brighten", "audio"].includes(id)) return state.watchedTankLog;
  if (id === "next_security") return state.watchedSecurityLog;
  return true;
}

function asChoice(id: string, group: string): Choice {
  const action = ACTIONS[id];
  return { id: action.id, label: action.label, cost: action.cost, group, ...(CHOICE_RECORDS[id] ? { fromRecord: true } : {}) };
}

export function getChoices(state: GameState): Choice[] {
  if (state.status !== "playing") return [];
  if (state.scene === "unknown") return [asChoice("unknown_identity", "通信")];
  if (state.doomed) return [asChoice("wait", "通信")];
  if (state.scene === "release_confirm") {
    const ids = ["release", "refuse", "alternative"];
    if (!state.drainageDisabled) ids.push("pressure", "stop_pump");
    return ids.map((id) => asChoice(id, "解除の確認"));
  }
  return Object.entries(CHOICE_GROUPS).flatMap(([group, ids]) => ids.filter((id) => {
    if (!recordSupports(state, id) || !physicallyAvailable(state, id) || !contextSupports(state, id)) return false;
    if (id === "hello" && state.completedActions.length > 0) return false;
    if (id === "power_location" && state.sharedFacts.includes("F02")) return false;
    if (id === "inspect_controls" && state.knownFacts.includes("F04")) return false;
    if (state.completedActions.includes(id) && !["location", "pressure"].includes(id) && !(id === "reassure" && state.trustYuna < 1)) return false;
    return true;
  }).map((id) => asChoice(id, group)));
}
