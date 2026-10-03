import { ACTIONS, CHOICE_RECORDS, KEYWORDS, LOOP_SECONDS, SCENE_CHOICES, SCRIPT, TRUE_FACTS } from "./scenario.ts";
import type { Choice, GameState, ScriptLine } from "./types.ts";

export type { Choice, GameState, Message, Ending } from "./types.ts";

export function createGame(): GameState {
  return {
    status: "idle", scene: "intro", loopCount: 1, remaining: LOOP_SECONDS,
    knownFacts: [], trustYuna: 0, powerEnabled: false, drainageDisabled: false,
    containmentReleased: false, watchedTankLog: false, watchedSecurityLog: false,
    questionedYunaIdentity: false, messages: [], ending: null, location: "section4",
    nextMessageId: 1, triggeredEvents: [], escapeTrapAt: null,
    pressureFailureAt: null, doomed: null, hasPumpClue: false, truthClosed: false,
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
  return append(state, SCRIPT[key] ?? []);
}

function facts(state: GameState, ids: string[]): GameState {
  return { ...state, knownFacts: [...new Set([...state.knownFacts, ...ids])] };
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

/**
 * Advance either wall-clock time or an action's cost. Every crossed event fires
 * once, chronologically. Clear has already been achieved in the UNKNOWN coda;
 * its final player response is outside the three-minute rescue deadline.
 */
export function advanceTime(state: GameState, seconds: number): GameState {
  if (state.status !== "playing" || state.scene === "unknown" || !Number.isFinite(seconds) || seconds <= 0) return state;
  const target = Math.max(0, state.remaining - seconds);
  const events: { at: number; key: string }[] = [
    { at: 120, key: "flood" }, { at: 60, key: "minute" },
    { at: 30, key: "thirty" }, { at: 10, key: "ten" }, { at: 0, key: "timeout" },
  ];
  if (state.escapeTrapAt !== null) events.push({ at: state.escapeTrapAt, key: "escapeFailure" });
  if (state.pressureFailureAt !== null) events.push({ at: state.pressureFailureAt, key: "pressureFailure" });
  events.sort((a, b) => b.at - a.at);
  let next = state;
  for (const event of events) {
    if (event.at > state.remaining || event.at < target || next.triggeredEvents.includes(event.key)) continue;
    next = { ...next, remaining: event.at, triggeredEvents: [...next.triggeredEvents, event.key] };
    if (event.key === "escapeFailure") return disconnect(facts(next, ["F04"]), event.key);
    if (event.key === "pressureFailure") return disconnect(facts({ ...next, hasPumpClue: true }, ["F05"]), event.key);
    if (event.key === "timeout") return disconnect(next, event.key);
    next = script(next, event.key === "thirty" && next.powerEnabled ? "thirtyPowered" : event.key);
    if (event.key === "thirty") next = facts(next, ["F02"]);
  }
  return { ...next, remaining: target };
}

const POWER_REQUIRED = new Set([
  "open_door", "inspect_controls", "tank", "vitals", "brighten", "audio", "security", "next_security",
  "central", "protocol", "pressure", "pressure_details", "stop_pump", "comms", "history",
  "signal", "maintain", "reinforce", "request_release", "release", "refuse", "alternative",
]);
const TRUTH_ACTIONS = new Set(["question_identity", "audio", "security", "next_security"]);

function execute(state: GameState, actionId: string, input?: string): GameState {
  if (state.status !== "playing") return state;
  const action = ACTIONS[actionId];
  if (!action) return state;
  if (state.scene === "unknown" && actionId !== "unknown_identity") return state;
  let next = append(state, [{ speaker: "YOU", text: input ?? action.label }]);

  if (state.doomed && actionId !== "wait") {
    next = advanceTime(next, 3);
    return next.status === "playing" ? append(next, [{ speaker: "YUNA", text: "操作が受け付けられない。隔壁が――" }]) : next;
  }
  if (POWER_REQUIRED.has(actionId) && !state.powerEnabled) {
    next = advanceTime(next, 3);
    return next.status === "playing" ? script(facts(next, ["F02"]), "noPower") : next;
  }
  if (TRUTH_ACTIONS.has(actionId) && state.truthClosed) {
    next = advanceTime(next, 3);
    return next.status === "playing" ? script(next, "truthClosed") : next;
  }
  if (actionId === "release" && state.scene !== "release_confirm") {
    // A free-form "open it" still receives the warning, never bypasses it.
    return requestRelease(next);
  }
  if (["find_code", "admin"].includes(actionId) && state.location !== "machine") {
    next = advanceTime(next, 25);
    if (next.status !== "playing") return next;
    next = script(facts({ ...next, location: "machine", scene: "machine" }, ["F02"]), "machine");
  }
  let cost = action.cost;
  if (actionId === "go_machine" && state.location === "machine") cost = 0;
  if (actionId === "enable_power" && !state.powerEnabled && state.location !== "machine") cost += 25;
  if (actionId === "enable_power" && state.powerEnabled) cost = 0;
  if (actionId === "stop_pump" && state.drainageDisabled) cost = 0;
  // All time is consumed before applying effects; a completed deadline loses.
  next = advanceTime(next, cost);
  if (next.status !== "playing") return next;
  next = {
    ...next, scene: action.scene ?? next.scene,
    trustYuna: Math.max(-2, Math.min(2, next.trustYuna + (action.trust ?? 0))),
  };
  next = facts(next, action.facts ?? []);
  if (action.lines) next = append(next, action.lines);

  switch (actionId) {
    case "hello": case "name": case "incident_intro":
      return script(next, "welcome");
    case "tank_question":
      return script(next, next.trustYuna >= 1 ? "tankTrusted" : "tankDistrust");
    case "go_machine":
      return script({ ...next, location: "machine" }, "machine");
    case "enable_power":
      if (state.powerEnabled) return append(next, [{ speaker: "SYSTEM", text: "EMERGENCY POWER ALREADY ONLINE" }]);
      if (state.location !== "machine") next = script(next, "codeFirst");
      return script(facts({ ...next, powerEnabled: true, location: "machine" }, ["F02"]), "power");
    case "back":
      return { ...next, scene: next.powerEnabled ? "powered" : next.location === "machine" ? "machine" : "contact" };
    case "open_door":
      return { ...next, doomed: "escape", escapeTrapAt: Math.max(0, next.remaining - 20) };
    case "tank": case "audio":
      return { ...next, scene: "tank", watchedTankLog: true };
    case "vitals": case "brighten":
      return { ...next, scene: "tank" };
    case "security": case "next_security":
      return { ...next, scene: "security", watchedSecurityLog: true };
    case "question_identity": {
      next = { ...next, questionedYunaIdentity: true };
      return next.trustYuna >= 1
        ? script(facts(next, ["F21"]), "identityHigh")
        : script({ ...next, truthClosed: true }, "identityLow");
    }
    case "reassure":
      return append(next, [{ speaker: "YUNA", text: next.powerEnabled ? "……分かった。あなたを信じる" : "……分かった。非常電源が必要なんだね" }]);
    case "central":
      return { ...next, location: "central" };
    case "pressure": case "pressure_details":
      return { ...next, hasPumpClue: true };
    case "stop_pump":
      return { ...next, drainageDisabled: true, hasPumpClue: true, location: "central" };
    case "request_release":
      return requestRelease(next, false);
    case "maintain": case "reinforce": case "refuse": case "alternative":
      return { ...next, doomed: "pressure", pressureFailureAt: Math.max(0, next.remaining - 12) };
    case "release": {
      next = facts({ ...next, containmentReleased: true }, ["F05"]);
      if (!next.drainageDisabled) return disconnect({ ...next, doomed: "order", hasPumpClue: true }, "orderFailure");
      next = script(next, next.trustYuna >= 1 ? "releaseTrusted" : "releaseDistrust");
      next = script(facts(next, ["F22"]), "released");
      if (next.loopCount === 1) return script(facts({ ...next, status: "ending", scene: "ending", ending: "secret" }, ["F23"]), "secret");
      if (TRUE_FACTS.every((id) => next.knownFacts.includes(id))) return { ...next, scene: "unknown" };
      return script({ ...next, status: "ending", scene: "ending", ending: "normal" }, "normal");
    }
    case "unknown_identity":
      if (state.scene !== "unknown") return append(next, [{ speaker: "YUNA", text: "水槽からの通信……？　まだ回線が繋がっていない" }]);
      return script(facts({ ...next, status: "ending", scene: "ending", ending: "true" }, ["F23"]), "true");
    default:
      return next;
  }
}

function requestRelease(state: GameState, consumeTime = true): GameState {
  let next = consumeTime ? advanceTime(state, ACTIONS.request_release.cost) : state;
  if (next.status !== "playing") return next;
  next = script(facts({ ...next, scene: "release_confirm" }, ["F04"]), "releaseWarning");
  if (!next.drainageDisabled) next = script({ ...next, hasPumpClue: true }, "pumpWarning");
  return next;
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
  for (const [actionId, aliases] of Object.entries(KEYWORDS)) {
    if (aliases.some((alias) => normalizeKeyword(alias) === normalized)) return execute(state, actionId, input);
  }
  if (state.scene === "unknown") {
    return append(state, [{ speaker: "YOU", text: input }, { speaker: "UNKNOWN", text: "聞いて。あなたが、知りたいことを", effect: "quiet" }]);
  }
  let next = append(state, [{ speaker: "YOU", text: input }]);
  next = advanceTime(next, 3);
  if (next.status !== "playing") return next;
  const hint = /^\d+$/.test(normalized)
    ? "その番号は認証されない。機械室の保守パネルなら、コードが残っているかもしれない"
    : !next.powerEnabled
      ? "うまく聞き取れなかった。場所や設備の名前を送って。まずは非常電源を探したい"
      : "操作を確認したい。『監視ログ』『中央管理端末』『圧力制御』のように、設備や指示を送って";
  return append(next, [{ speaker: "YUNA", text: hint }]);
}

export function getChoices(state: GameState): Choice[] {
  if (state.status !== "playing") return [];
  let ids = [...(SCENE_CHOICES[state.scene] ?? SCENE_CHOICES.contact)];
  if (state.doomed) ids = ["wait"];

  // Knowledge governs what the terminal suggests, not what the player can do.
  const recordSupports = (id: string): boolean => {
    if (id === "stop_pump" && state.hasPumpClue) return true;
    return (CHOICE_RECORDS[id] ?? []).every((fact) => state.knownFacts.includes(fact));
  };
  const physicallyAvailable = (id: string): boolean => {
    if (POWER_REQUIRED.has(id) && !state.powerEnabled) return false;
    if (TRUTH_ACTIONS.has(id) && state.truthClosed) return false;
    if (id === "go_machine" && (state.powerEnabled || state.location === "machine")) return false;
    if (id === "enable_power" && state.powerEnabled) return false;
    if (id === "stop_pump" && state.drainageDisabled) return false;
    return true;
  };
  ids = ids.filter((id) => recordSupports(id) && physicallyAvailable(id));

  // Keep useful exploration and a way back while presenting at most one next
  // rescue step in the central menu. The protocol screen still permits mistakes.
  if (state.scene === "contact" && ids.includes("go_machine")) ids = ids.filter((id) => id !== "escape");
  if (state.scene === "questions" && ids.includes("go_machine")) ids = ids.filter((id) => id !== "power_location");
  if (state.scene === "powered" && ids.includes("central")) ids = ids.filter((id) => id !== "inspect_controls");
  if (state.scene === "central") {
    const nextStep = ids.includes("stop_pump") ? "stop_pump" : ids.includes("request_release") ? "request_release" : "protocol";
    ids = ids.filter((id) => !["stop_pump", "request_release", "protocol"].includes(id) || id === nextStep);
  }
  if (state.scene === "protocol" && ids.includes("request_release")) ids = ids.filter((id) => id !== "pressure");
  return ids.slice(0, 4).map((id) => {
    const action = ACTIONS[id];
    return { id: action.id, label: action.label, cost: action.cost, ...(CHOICE_RECORDS[id] ? { fromRecord: true } : {}) };
  });
}
