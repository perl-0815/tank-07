import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceTime,
  createGame,
  getChoices,
  performAction,
  reconnect,
  startGame,
  submitKeyword,
} from "../src/game/engine.ts";
import type { GameState } from "../src/game/types.ts";
import { ACTIONS, CHOICE_CONTEXTS, CHOICE_GROUPS, FACTS, KEYWORDS } from "../src/game/scenario.ts";
import { ECHO_INPUT, FREE_REPLIES } from "../src/game/free-input.ts";

function start(): GameState {
  return startGame(createGame());
}

function say(state: GameState, text: string): GameState {
  return submitKeyword(state, text);
}

function choose(state: GameState, id: string): GameState {
  assert.ok(!getChoices(state).some((choice) => choice.id === "reassure" || choice.label.includes("信じて")));
  assert.ok(
    getChoices(state).some((choice) => choice.id === id),
    `Action ${id} must be visible in scene ${state.scene}`,
  );
  return performAction(state, id);
}

function nextLoop(state: GameState): GameState {
  const disconnected = advanceTime(state, 180);
  assert.equal(disconnected.status, "disconnected");
  return reconnect(disconnected);
}

function clearByKnownCommands(state: GameState): GameState {
  state = say(state, "7319");
  assert.equal(state.powerEnabled, true);
  state = say(state, "第7区画の排水ポンプを停止");
  assert.equal(state.drainageDisabled, true);
  state = say(state, "隔離プロトコルを解除");
  return say(state, "開ける");
}

test("the initial connection starts a full three-minute loop", () => {
  const idle = createGame();
  assert.equal(idle.status, "idle");
  const game = startGame(idle);
  assert.equal(game.status, "playing");
  assert.equal(game.remaining, 180);
  assert.equal(game.loopCount, 1);
  assert.deepEqual(game.knownFacts, []);
  assert.equal(game.powerEnabled, false);
  assert.equal(game.drainageDisabled, false);
  assert.equal(game.containmentReleased, false);
  assert.ok(game.messages.some((message) => message.text.includes("聞こえる")));
  assert.deepEqual(getChoices(game).map((choice) => choice.id), ["hello", "name", "incident", "location"]);
});

test("previously unknown correct commands clear loop one with SECRET END", () => {
  const game = clearByKnownCommands(start());
  assert.equal(game.loopCount, 1);
  assert.equal(game.powerEnabled, true);
  assert.equal(game.drainageDisabled, true);
  assert.equal(game.containmentReleased, true);
  assert.equal(game.status, "ending");
  assert.equal(game.ending, "secret");
  assert.ok(game.messages.some((message) => message.text.includes("今度は早かったね")));
  assert.ok(game.remaining > 0);
});

test("a later clear without the six truth facts reaches NORMAL END", () => {
  const game = clearByKnownCommands(nextLoop(start()));
  assert.equal(game.loopCount, 2);
  assert.equal(game.status, "ending");
  assert.equal(game.ending, "normal");
  assert.ok(game.messages.some((message) => message.text.includes("SURVIVORS")));
});

test("correct full-width authorization is normalized and usable before learning F03", () => {
  const before = start();
  assert.equal(before.knownFacts.includes("F03"), false);
  const game = say(before, "  ７３１９  ");
  assert.equal(game.powerEnabled, true);
  assert.equal(game.knownFacts.includes("F03"), true);
  assert.ok(game.trustYuna < before.trustYuna);
});

test("a reconnect preserves information but resets physical state and trust", () => {
  let game = say(start(), "7319");
  game = say(game, "第7区画の排水ポンプを停止");
  assert.equal(game.powerEnabled, true);
  assert.equal(game.drainageDisabled, true);
  assert.notEqual(game.trustYuna, 0);
  const disconnected = advanceTime(game, 180);
  const facts = [...disconnected.knownFacts];
  const loop = game.loopCount;
  game = reconnect(disconnected);
  assert.equal(game.loopCount, loop + 1);
  assert.equal(game.remaining, 180);
  assert.equal(game.status, "playing");
  assert.deepEqual(game.knownFacts, facts);
  assert.equal(game.trustYuna, 0);
  assert.equal(game.powerEnabled, false);
  assert.equal(game.drainageDisabled, false);
  assert.equal(game.containmentReleased, false);
  assert.equal(game.watchedTankLog, false);
  assert.equal(game.watchedSecurityLog, false);
  assert.equal(game.questionedYunaIdentity, false);
});

test("timer expiration ends the connection exactly at zero and further ticks are inert", () => {
  const game = advanceTime(start(), 180);
  assert.equal(game.remaining, 0);
  assert.equal(game.status, "disconnected");
  assert.equal(game.ending, null);
  assert.ok(game.messages.some((message) => message.text.includes("CONNECTION TERMINATED")));
  assert.deepEqual(advanceTime(game, 30), game);
  assert.deepEqual(say(game, "7319"), game);
});

test("an invalid keyword gives feedback and leaves the game recoverable", () => {
  const before = start();
  const invalid = say(before, "quantum-banana-unknown");
  assert.equal(invalid.status, "playing");
  assert.equal(invalid.powerEnabled, false);
  assert.ok(invalid.messages.length > before.messages.length);
  assert.ok(invalid.messages.slice(before.messages.length).some((message) => message.speaker !== "YOU"));
  assert.equal(say(invalid, "7319").powerEnabled, true);
});

test("empty input has no game effect", () => {
  const game = start();
  assert.deepEqual(say(game, " \n\t "), game);
});

test("pump shutdown requires power but not previously acquired facts", () => {
  let game = say(start(), "第7区画の排水ポンプを停止");
  assert.equal(game.drainageDisabled, false);
  assert.equal(game.status, "playing");
  game = say(game, "7319");
  game = say(game, "第7区画の排水ポンプを停止");
  assert.equal(game.drainageDisabled, true);
});

test("releasing containment before stopping drainage cannot be repaired afterward", () => {
  let game = say(start(), "7319");
  game = say(game, "隔離プロトコルを解除");
  game = say(game, "開ける");
  assert.equal(game.status, "disconnected");
  assert.equal(game.ending, null);
  assert.equal(game.drainageDisabled, false);
  game = say(game, "第7区画の排水ポンプを停止");
  assert.equal(game.ending, null);
  assert.equal(game.status, "disconnected");
});

function collectTankFacts(state: GameState): GameState {
  if (!state.sharedTopics.includes("tank07")) state = choose(state, "incident");
  state = say(state, "7319");
  state = choose(state, "tank");
  state = choose(state, "vitals");
  state = choose(state, "brighten");
  return choose(state, "audio");
}

function collectIdentityFacts(state: GameState): GameState {
  state = choose(state, "hello");
  state = say(state, "7319");
  state = choose(state, "security");
  state = choose(state, "next_security");
  return choose(state, "question_identity");
}

test("six truth facts can be learned through choices across loops and unlock interactive TRUE END", () => {
  let game = collectTankFacts(start());
  for (const fact of ["F10", "F11", "F14"]) {
    assert.ok(game.knownFacts.includes(fact), `Tank investigation must provide ${fact}`);
  }
  game = collectIdentityFacts(nextLoop(game));
  for (const fact of ["F10", "F11", "F12", "F13", "F14", "F21"]) {
    assert.ok(game.knownFacts.includes(fact), `The two investigations must provide ${fact}`);
  }
  game = clearByKnownCommands(nextLoop(game));
  assert.equal(game.loopCount, 3);
  assert.equal(game.ending, null);
  assert.ok(getChoices(game).some((choice) => choice.id === "unknown_identity"));
  const waitingForPlayer = advanceTime(game, 500);
  assert.equal(waitingForPlayer.status, game.status);
  assert.equal(waitingForPlayer.remaining, game.remaining);
  game = choose(waitingForPlayer, "unknown_identity");
  assert.equal(game.status, "ending");
  assert.equal(game.ending, "true");
  assert.ok(game.messages.some((message) => message.text.includes("LOOP COUNT")));
});

test("identity information can be used before it is recorded when trust is high", () => {
  let game = choose(start(), "hello");
  assert.equal(game.knownFacts.includes("F12"), false);
  assert.equal(game.knownFacts.includes("F13"), false);
  game = say(game, "君、本当にユナ？");
  assert.equal(game.questionedYunaIdentity, true);
  assert.equal(game.knownFacts.includes("F21"), true);
});

test("investigation and identity flags reset even after both logs were actually read", () => {
  let game = collectIdentityFacts(start());
  game = choose(game, "tank");
  game = choose(game, "audio");
  assert.equal(game.watchedTankLog, true);
  assert.equal(game.watchedSecurityLog, true);
  assert.equal(game.questionedYunaIdentity, true);
  game = nextLoop(game);
  assert.equal(game.watchedTankLog, false);
  assert.equal(game.watchedSecurityLog, false);
  assert.equal(game.questionedYunaIdentity, false);
  assert.ok(game.knownFacts.includes("F10"));
  assert.ok(game.knownFacts.includes("F13"));
  assert.ok(game.knownFacts.includes("F21"));
});

test("low-trust identity questioning limits truth conversation but does not prevent rescue", () => {
  let game = say(start(), "7319");
  assert.ok(game.trustYuna < 1);
  game = say(game, "君、本当にユナ？");
  assert.equal(game.questionedYunaIdentity, true);
  assert.equal(game.knownFacts.includes("F21"), false);
  game = say(game, "第7区画の排水ポンプを停止");
  game = say(game, "隔離プロトコルを解除");
  game = say(game, "開ける");
  assert.equal(game.ending, "secret");
});

test("all ten specified image events are reachable through playable choices", () => {
  const images = new Set<string>();
  function collect(game: GameState) {
    for (const message of game.messages) {
      if (message.imageId) images.add(message.imageId);
    }
    return game;
  }
  let game = choose(start(), "hello");
  game = choose(game, "location");
  collect(game);
  game = collect(collectTankFacts(game));
  collect(advanceTime(game, 180));
  game = collect(collectIdentityFacts(nextLoop(game)));
  game = collect(clearByKnownCommands(nextLoop(game)));
  collect(choose(game, "unknown_identity"));
  assert.deepEqual([...images].sort(), Array.from({ length: 10 }, (_, index) => `IMG_${String(index + 1).padStart(2, "0")}`));
});

test("an operation cannot succeed after it consumes the last available seconds", () => {
  let game = advanceTime(start(), 179);
  assert.equal(game.remaining, 1);
  game = say(game, "7319");
  assert.equal(game.remaining, 0);
  assert.equal(game.status, "disconnected");
  assert.equal(game.powerEnabled, false);
  assert.equal(game.ending, null);
});

test("zero and negative elapsed time do not extend or consume the connection", () => {
  const game = start();
  assert.deepEqual(advanceTime(game, 0), game);
  assert.deepEqual(advanceTime(game, -60), game);
});

test("the flooding event occurs at 120 seconds and does not repeat on later ticks", () => {
  let game = advanceTime(start(), 59);
  assert.equal(game.remaining, 121);
  assert.equal(game.messages.some((message) => message.imageId === "IMG_02"), false);
  game = advanceTime(game, 1);
  assert.equal(game.remaining, 120);
  const floodingImages = game.messages.filter((message) => message.imageId === "IMG_02").length;
  assert.equal(floodingImages, 1);
  game = advanceTime(game, 1);
  assert.equal(game.messages.filter((message) => message.imageId === "IMG_02").length, floodingImages);
});

test("large elapsed deltas still surface intermediate flooding and final signal failure", () => {
  const game = advanceTime(start(), 1_000);
  assert.equal(game.remaining, 0);
  assert.equal(game.status, "disconnected");
  assert.ok(game.messages.some((message) => message.imageId === "IMG_02"));
  assert.ok(game.messages.some((message) => message.text.includes("SIGNAL INSTABILITY")));
  assert.ok(game.messages.some((message) => message.text.includes("CONNECTION TERMINATED")));
});

test("the direct escape route relocks and reveals the central isolation clue", () => {
  let game = say(start(), "7319");
  game = choose(game, "escape");
  game = choose(game, "open_door");
  game = advanceTime(game, 20);
  assert.ok(game.knownFacts.includes("F04"));
  assert.ok(game.messages.some((message) => message.text.includes("ISOLATION PROTOCOL ACTIVATED")));
  assert.equal(game.ending, null);
});

for (const decision of ["refuse", "alternative"] as const) {
  test(`declining release through ${decision} provides a pressure-failure clue`, () => {
    let game = say(start(), "7319");
    game = choose(game, "inspect_controls");
    game = choose(game, "central");
    game = choose(game, "pressure");
    game = choose(game, "protocol");
    game = choose(game, "request_release");
    game = choose(game, decision);
    assert.equal(game.containmentReleased, false);
    game = advanceTime(game, 180);
    assert.equal(game.status, "disconnected");
    assert.equal(game.ending, null);
    assert.ok(game.messages.some((message) => message.text.includes("STRUCTURAL FAILURE CAUSED BY CONTAINMENT PRESSURE")));
  });
}

test("the final release must finish before the deadline, including its ten-second event", () => {
  for (const available of [18, 19]) {
    let game = say(start(), "7319");
    game = say(game, "第7区画の排水ポンプを停止");
    game = say(game, "隔離プロトコルを解除");
    game = advanceTime(game, game.remaining - available);
    assert.equal(game.remaining, available);
    game = say(game, "開ける");
    if (available === 18) {
      assert.equal(game.status, "disconnected");
      assert.equal(game.ending, null);
      assert.equal(game.containmentReleased, false);
      assert.equal(game.remaining, 0);
    } else {
      assert.equal(game.status, "ending");
      assert.equal(game.ending, "secret");
      assert.equal(game.remaining, 1);
    }
  }
});

test("60-, 30-, and 10-second warnings fire once and in chronological order", () => {
  let game = advanceTime(start(), 120);
  assert.equal(game.remaining, 60);
  assert.ok(game.messages.some((message) => message.text.includes("60 SECONDS REMAINING")));
  game = advanceTime(game, 30);
  assert.equal(game.remaining, 30);
  assert.ok(game.messages.some((message) => message.text.includes("SECTION-04 LOCKDOWN")));
  game = advanceTime(game, 20);
  assert.equal(game.remaining, 10);
  game = advanceTime(game, 1);
  const warnings = ["60 SECONDS REMAINING", "SECTION-04 LOCKDOWN", "SIGNAL INSTABILITY DETECTED"];
  const positions = warnings.map((warning) => {
    assert.equal(game.messages.filter((message) => message.text.includes(warning)).length, 1);
    return game.messages.findIndex((message) => message.text.includes(warning));
  });
  assert.ok(positions[0] < positions[1] && positions[1] < positions[2]);
});

test("wrong authorization does not enable power and a subsequent correct code recovers", () => {
  let game = say(start(), "7318");
  assert.equal(game.powerEnabled, false);
  assert.equal(game.knownFacts.includes("F03"), false);
  assert.ok(game.messages.some((message) => message.text.includes("認証されない")));
  game = say(game, "7319");
  assert.equal(game.powerEnabled, true);
});

test("a completed ending remains stable until reconnect is explicitly requested", () => {
  const ended = clearByKnownCommands(start());
  assert.deepEqual(advanceTime(ended, 500), ended);
  assert.deepEqual(say(ended, "7319"), ended);
  assert.deepEqual(performAction(ended, "hello"), ended);
  assert.equal(getChoices(ended).length, 0);
  const game = reconnect(ended);
  assert.equal(game.status, "playing");
  assert.equal(game.ending, null);
  assert.equal(game.loopCount, 2);
});

test("discovery reveals the relevant recorded suggestions without exposing the route in advance", () => {
  let game = start();
  const choice = (id: string) => getChoices(game).find((item) => item.id === id);
  assert.equal(choice("go_machine"), undefined);
  game = choose(game, "hello");
  game = choose(game, "incident");
  assert.equal(choice("go_machine"), undefined);
  assert.equal(choice("power_location")?.fromRecord, undefined);

  game = choose(game, "power_location");
  assert.equal(choice("go_machine")?.fromRecord, true);
  game = choose(game, "go_machine");
  assert.equal(choice("enable_power"), undefined);
  assert.equal(choice("find_code")?.fromRecord, undefined);
  game = choose(game, "find_code");
  assert.equal(choice("enable_power")?.fromRecord, true);
  game = choose(game, "enable_power");
  assert.equal(choice("central"), undefined);
  assert.equal(choice("stop_pump"), undefined);
  assert.equal(choice("request_release"), undefined);

  game = choose(game, "inspect_controls");
  assert.equal(choice("central")?.fromRecord, true);
  assert.equal(choice("inspect_controls")?.selected, true);
  game = choose(game, "central");
  assert.equal(choice("stop_pump"), undefined);
  game = choose(game, "protocol");
  assert.equal(choice("request_release"), undefined);
  assert.ok(choice("pressure"), "The protocol screen must retain a discovery path");
  game = choose(game, "pressure");
  assert.equal(choice("stop_pump")?.fromRecord, true);
  game = choose(game, "stop_pump");
  assert.equal(choice("stop_pump"), undefined);
  assert.equal(choice("request_release")?.fromRecord, true);
});

test("a new player can discover the route and finish using only visible buttons", () => {
  let game = start();
  const route = [
    "hello", "incident", "power_location", "go_machine", "find_code", "enable_power",
    "inspect_controls", "central", "pressure", "stop_pump", "request_release", "release",
  ];
  for (const action of route) {
    assert.ok(getChoices(game).every((choice) => choice.id !== "back" && choice.id !== "more"));
    game = choose(game, action);
  }
  assert.equal(game.status, "ending");
  assert.equal(game.ending, "secret");
  assert.ok(game.remaining > 0);
});

test("recorded suggestions return in the next loop at the physically appropriate step", () => {
  let game = choose(start(), "hello");
  for (const action of ["incident", "power_location", "go_machine", "find_code", "enable_power", "inspect_controls", "central", "pressure"]) {
    game = choose(game, action);
  }
  game = nextLoop(game);
  const atStart = getChoices(game);
  assert.equal(atStart.find((choice) => choice.id === "go_machine")?.fromRecord, true);
  for (const action of ["enable_power", "central", "stop_pump", "request_release"]) {
    assert.equal(atStart.some((choice) => choice.id === action), false);
  }
  game = choose(game, "go_machine");
  assert.equal(getChoices(game).find((choice) => choice.id === "enable_power")?.fromRecord, true);
  game = choose(game, "enable_power");
  game = choose(game, "central");
  assert.equal(getChoices(game).find((choice) => choice.id === "stop_pump")?.fromRecord, true);
  assert.equal(getChoices(game).find((choice) => choice.id === "request_release")?.fromRecord, true);
  game = choose(game, "stop_pump");
  game = choose(game, "request_release");
  game = choose(game, "release");
  assert.equal(game.ending, "normal");
});

test("hiding a suggestion never invalidates a correct directly entered instruction", () => {
  let game = start();
  assert.equal(getChoices(game).some((choice) => choice.id === "go_machine"), false);
  game = say(game, "第2機械室へ");
  assert.equal(game.location, "machine");
  assert.equal(game.knownFacts.includes("F03"), false);
  assert.equal(getChoices(game).some((choice) => choice.id === "enable_power"), false);
  game = say(game, "7319");
  assert.equal(game.powerEnabled, true);
  assert.equal(game.knownFacts.includes("F04"), false);
  assert.equal(game.knownFacts.includes("F05"), false);
  assert.equal(game.hasPumpClue, false);
  game = say(game, "第7区画の排水ポンプを停止");
  assert.equal(game.drainageDisabled, true);
  assert.equal(getChoices(game).some((choice) => choice.id === "request_release"), false);
  game = say(game, "隔離プロトコルを解除");
  game = choose(game, "release");
  assert.equal(game.ending, "secret");
});

test("the direct release warning persists the explained pump procedure as F05", () => {
  let game = say(start(), "7319");
  game = say(game, "隔離プロトコルを解除");
  assert.equal(game.hasPumpClue, true);
  assert.equal(game.knownFacts.includes("F05"), true);
  game = say(game, "中央管理端末");
  assert.equal(getChoices(game).find((choice) => choice.id === "stop_pump")?.fromRecord, true);
});

test("a correct central-terminal keyword works before its discovery suggestion exists", () => {
  let game = say(start(), "7319");
  assert.equal(game.knownFacts.includes("F04"), false);
  assert.equal(getChoices(game).some((choice) => choice.id === "central"), false);
  game = say(game, "中央管理端末");
  assert.equal(game.scene, "central");
  assert.equal(game.location, "machine");
  assert.equal(game.centralAccessed, true);
  assert.equal(game.knownFacts.includes("F04"), true);
});

function powerByDiscovery(): GameState {
  let game = start();
  for (const action of ["hello", "incident", "power_location", "go_machine", "find_code", "enable_power"]) game = choose(game, action);
  return game;
}

function newText(before: GameState, after: GameState): string {
  return after.messages.slice(before.messages.length).map((message) => message.text).join("\n");
}

test("Yuna recognizes information she shared this loop without foreknowledge suspicion or trust loss", () => {
  const game = powerByDiscovery();
  assert.equal(game.trustYuna, 1);
  assert.equal(game.usedForeknowledge, false);
  assert.ok(game.sharedFacts.includes("F02"));
  assert.ok(game.sharedFacts.includes("F03"));
  const transcript = game.messages.map((message) => message.text).join("\n");
  assert.doesNotMatch(transcript, /なんで場所を知ってる|あなた何者|どうして知ってる/);
  assert.match(transcript, /さっき見つけたコードで通った/);
});

test("retained records do not falsely become Yuna's current-loop knowledge", () => {
  let game = nextLoop(powerByDiscovery());
  assert.ok(game.knownFacts.includes("F03"));
  assert.deepEqual(game.sharedFacts, []);
  assert.deepEqual(game.completedActions, []);
  game = choose(game, "go_machine");
  assert.ok(game.messages.some((message) => message.text.includes("なんで場所を知ってる")));
  game = choose(game, "enable_power");
  assert.equal(game.trustYuna, -1);
  assert.equal(game.usedForeknowledge, true);
  assert.ok(game.messages.some((message) => message.text.includes("あなた何者")));
});

test("rediscovering a retained code restores the natural response in the new loop", () => {
  let game = nextLoop(powerByDiscovery());
  game = choose(game, "incident");
  game = choose(game, "power_location");
  game = choose(game, "go_machine");
  game = choose(game, "find_code");
  const before = game;
  game = choose(game, "enable_power");
  assert.equal(game.trustYuna, before.trustYuna);
  assert.doesNotMatch(newText(before, game), /何者|どうして/);
});

test("a fully discovered first-loop clear retains SECRET with a coherent Yuna response", () => {
  let game = powerByDiscovery();
  for (const action of ["inspect_controls", "central", "pressure", "stop_pump", "request_release", "release"]) game = choose(game, action);
  assert.equal(game.ending, "secret");
  assert.equal(game.usedForeknowledge, false);
  assert.ok(game.messages.some((message) => message.text.includes("一緒に調べた手順")));
  assert.ok(game.messages.some((message) => message.text.includes("今度は早かったね")));
  assert.ok(!game.messages.some((message) => message.text.includes("どうして全部知ってる")));
});

test("location, escape, and incident responses match the current physical state", () => {
  let game = say(start(), "7319");
  let before = game;
  game = say(game, "現在地");
  assert.match(newText(before, game), /今は第2機械室/);
  assert.doesNotMatch(newText(before, game), /第4研究区画。奥の扉/);
  game = say(game, "中央管理端末");
  assert.equal(game.location, "machine");
  before = game;
  game = say(game, "逃げられない？");
  assert.match(newText(before, game), /非常電源は戻った/);
  assert.doesNotMatch(newText(before, game), /非常電源が戻れば/);
  before = game;
  game = say(game, "何が起きた？");
  assert.match(newText(before, game), /そのとき私は、第4研究区画にいた/);
});

test("repeating power, travel, and pump operations is idempotent and does not replay surprise", () => {
  let game = say(start(), "7319");
  const trust = game.trustYuna;
  let before = game;
  game = say(game, "7319");
  assert.equal(game.trustYuna, trust);
  assert.equal(game.remaining, before.remaining);
  assert.doesNotMatch(newText(before, game), /何者|本当に通った/);
  before = game;
  game = say(game, "第2機械室へ");
  assert.equal(game.remaining, before.remaining);
  assert.doesNotMatch(newText(before, game), /認証コードが必要|着いた|なんで場所/);
  game = say(game, "第7区画の排水ポンプを停止");
  before = game;
  game = say(game, "第7区画の排水ポンプを停止");
  assert.equal(game.remaining, before.remaining);
  assert.match(newText(before, game), /停止したまま/);
  assert.doesNotMatch(newText(before, game), /そんなことしたら/);
});

test("pressure readings and shutdown dialogue reflect the already explained procedure", () => {
  let game = powerByDiscovery();
  game = choose(game, "inspect_controls");
  game = choose(game, "central");
  game = choose(game, "pressure");
  let before = game;
  game = choose(game, "stop_pump");
  assert.match(newText(before, game), /確認した保守手順どおり/);
  assert.doesNotMatch(newText(before, game), /そんなことしたら/);
  before = game;
  game = say(game, "圧力制御");
  assert.match(newText(before, game), /DRAINAGE PUMP: OFFLINE/);
  assert.doesNotMatch(newText(before, game), /DRAINAGE PUMP: ACTIVE|PRESSURE: RISING/);
  before = game;
  game = say(game, "なぜ圧力が上がる？");
  assert.match(newText(before, game), /ポンプはもう止まった/);
  assert.doesNotMatch(newText(before, game), /排水と隔離が同時に動いて/);
});

test("the identity question acknowledges surveillance watched together", () => {
  const game = collectIdentityFacts(start());
  assert.ok(game.messages.some((message) => message.text.includes("私も、その記録を見た")));
  assert.ok(!game.messages.some((message) => message.text.includes("それ、誰から聞いた")));
});

test("the flat list preserves available investigations across unrelated responses", () => {
  let game = powerByDiscovery();
  for (const action of ["tank", "security", "inspect_controls", "central", "comms"]) game = choose(game, action);
  game = choose(game, "location");
  const choices = getChoices(game);
  for (const id of ["vitals", "brighten", "audio", "next_security", "protocol", "pressure", "history", "signal"]) {
    assert.ok(choices.some((choice) => choice.id === id), `${id} remains available without returning through a menu`);
  }
  assert.ok(choices.length > 4);
  assert.ok(choices.every((choice) => typeof choice.group === "string"));
  assert.ok(!choices.some((choice) => ["back", "more"].includes(choice.id)));
});

test("the flat list respects unfinished discovery and confirmation boundaries", () => {
  let game = say(start(), "7319");
  for (const id of ["vitals", "brighten", "audio", "next_security", "pressure", "history", "signal"]) {
    assert.ok(!getChoices(game).some((choice) => choice.id === id));
  }
  game = say(game, "隔離プロトコルを解除");
  assert.deepEqual(getChoices(game).map((choice) => choice.id), ["release", "refuse", "alternative", "pressure", "stop_pump"]);
  assert.ok(getChoices(game).find((choice) => choice.id === "stop_pump")?.fromRecord);
});

test("checking separate surveillance records recovers trust after an unexplained code", () => {
  let game = say(start(), "7319");
  assert.equal(game.trustYuna, -1);
  const before = game;
  game = say(game, "聞こえる");
  assert.doesNotMatch(newText(before, game), /通信が全部死んでる|あと数分/);
  assert.equal(game.trustYuna, -1, "Repeating the introduction does not build trust");
  game = choose(game, "security");
  assert.equal(game.trustYuna, 0);
  game = choose(game, "next_security");
  assert.equal(game.trustYuna, 1);
  game = choose(game, "question_identity");
  assert.ok(game.knownFacts.includes("F21"));
});

test("each surveillance record builds trust once per connection, without carrying trust across loops", () => {
  let game = say(start(), "7319");
  game = choose(game, "security");
  assert.equal(game.trustYuna, 0);
  game = say(game, "監視ログ");
  game = say(game, "監視ログを見る");
  assert.equal(game.trustYuna, 0, "Replaying the same recording cannot replace checking another record");
  game = choose(game, "next_security");
  assert.equal(game.trustYuna, 1);
  game = say(game, "5分前");
  assert.equal(game.trustYuna, 1);

  game = nextLoop(game);
  assert.equal(game.trustYuna, 0);
  assert.ok(game.knownFacts.includes("F12") && game.knownFacts.includes("F13"));
  assert.deepEqual(game.completedActions, []);
  game = choose(game, "go_machine");
  game = choose(game, "enable_power");
  assert.equal(game.trustYuna, -1);
  game = choose(game, "security");
  assert.equal(game.trustYuna, 0, "A remembered record can still be checked with this connection's Yuna");
  game = choose(game, "next_security");
  assert.equal(game.trustYuna, 1);
  game = choose(game, "question_identity");
  assert.ok(game.knownFacts.includes("F21"));
});

test("a recording interrupted by the deadline grants neither information nor trust", () => {
  let game = say(start(), "7319");
  game = advanceTime(game, game.remaining - 15);
  const trust = game.trustYuna;
  game = choose(game, "security");
  assert.equal(game.status, "disconnected");
  assert.equal(game.trustYuna, trust);
  assert.ok(!game.completedActions.includes("security"));
  assert.ok(!game.knownFacts.includes("F12"));
});

test("natural exploration followed by recorded buttons reaches SECRET and NORMAL without reassurance", () => {
  let game = powerByDiscovery();
  for (const id of ["inspect_controls", "central", "pressure", "stop_pump", "request_release", "release"]) game = choose(game, id);
  assert.equal(game.ending, "secret");
  game = reconnect(game);
  for (const id of ["go_machine", "enable_power", "stop_pump", "request_release", "release"]) game = choose(game, id);
  assert.equal(game.ending, "normal");
  assert.equal(game.trustYuna, -1, "A low-trust rescue still completes");
});

test("button-only investigations and remembered shortcuts reach TRUE without reassurance", () => {
  let game = powerByDiscovery();
  for (const id of ["tank", "vitals", "audio"]) game = choose(game, id);
  for (const fact of ["F10", "F11", "F14"]) assert.ok(game.knownFacts.includes(fact));

  game = nextLoop(game);
  for (const id of ["go_machine", "enable_power"]) game = choose(game, id);
  assert.equal(game.trustYuna, -1);
  for (const id of ["security", "next_security", "question_identity", "inspect_controls", "central", "pressure"]) game = choose(game, id);
  assert.equal(game.trustYuna, 1);
  for (const fact of ["F04", "F05", "F12", "F13", "F21"]) assert.ok(game.knownFacts.includes(fact));
  assert.equal(game.truthClosed, false);

  game = nextLoop(game);
  for (const id of ["go_machine", "enable_power", "stop_pump", "request_release", "release", "unknown_identity"]) game = choose(game, id);
  assert.equal(game.ending, "true");
  assert.equal(game.loopCount, 3);
  assert.ok(!game.completedActions.includes("reassure"));
});

test("warning knowledge survives a reload-style restoration without ephemeral flags", () => {
  let game = say(start(), "7319");
  game = say(game, "隔離プロトコルを解除");
  const restored = startGame({ ...createGame(), knownFacts: [...game.knownFacts], loopCount: 2 });
  game = say(restored, "7319");
  assert.ok(getChoices(game).some((choice) => choice.id === "stop_pump"));
  game = choose(game, "stop_pump");
  assert.ok(getChoices(game).some((choice) => choice.id === "request_release"));
});

test("all nonempty user keywords produce feedback, including old navigation and recognized UNKNOWN inputs", () => {
  for (const text of ["戻る", "操作メニュー", "unknown-command"]) {
    const before = start();
    const game = say(before, text);
    assert.ok(game.messages.length > before.messages.length);
  }
  let game = collectTankFacts(start());
  game = collectIdentityFacts(nextLoop(game));
  game = clearByKnownCommands(nextLoop(game));
  assert.equal(game.scene, "unknown");
  for (const text of ["7319", "戻る", "聞こえる", "中央管理端末"]) {
    const before = game;
    game = say(game, text);
    assert.ok(game.messages.length > before.messages.length);
    assert.equal(game.messages.at(-1)?.speaker, "UNKNOWN");
    assert.equal(game.remaining, before.remaining);
  }
  game = say(game, "君は水槽07？");
  assert.equal(game.ending, "true");
});

function assertChronological(game: GameState): void {
  let previous = 180;
  const ids = new Set<string>();
  for (const message of game.messages) {
    assert.ok(message.remaining >= 0 && message.remaining <= previous, `${message.id}: ${message.remaining} after ${previous}`);
    assert.ok(!ids.has(message.id));
    ids.add(message.id);
    previous = message.remaining;
  }
  assert.ok(game.remaining >= 0 && game.remaining <= previous);
  for (const event of [game.escapeTrapAt, game.pressureFailureAt]) assert.ok(event === null || event >= 0);
}

test("action messages and every crossed timer boundary stay chronologically ordered", () => {
  let game = advanceTime(start(), 50);
  game = say(game, "第2機械室へ");
  assertChronological(game);
  const departure = game.messages.findIndex((message) => message.text.includes("第2機械室へ行く"));
  const flood = game.messages.findIndex((message) => message.imageId === "IMG_02");
  const arrival = game.messages.findIndex((message) => message.text.includes("着いた。非常電源"));
  assert.ok(departure < flood && flood < arrival);
  assert.match(game.messages[flood].text, /通路/);
  game = say(game, "7319");
  game = advanceTime(game, 500);
  assertChronological(game);
});

test("failures near the deadline never create negative or backward event timestamps", () => {
  for (const action of ["open_door", "maintain", "reinforce"]) {
    let game = say(start(), "7319");
    game = advanceTime(game, game.remaining - 15);
    game = performAction(game, action);
    assertChronological(game);
    game = advanceTime(game, 500);
    assertChronological(game);
    assert.equal(game.status, "disconnected");
    assert.equal(game.remaining, 0);
  }
});

test("deterministic mixed action sequences preserve timer and message invariants across loops", () => {
  let game = start();
  let seed = 7319;
  const commands = ["7319", "圧力制御", "現在地", "第2機械室へ", "聞こえる", "信じて", "監視ログ", "5分前", "第7区画の排水ポンプを停止", "隔離プロトコルを解除", "開ける", "待つ", "戻る"];
  for (let step = 0; step < 600; step++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    if (game.status === "ending" || game.status === "disconnected") game = reconnect(game);
    if (game.scene === "unknown") game = say(game, "君は水槽07？");
    else if (seed % 4 === 0) game = advanceTime(game, seed % 45 + 1);
    else game = say(game, commands[seed % commands.length]);
    assertChronological(game);
    assert.ok(!getChoices(game).some((choice) => choice.id === "reassure" || choice.label.includes("信じて")));
  }
});

const choiceIds = (game: GameState) => getChoices(game).map((choice) => choice.id);

test("every flat candidate has an explicit editable conversation-context rule", () => {
  for (const ids of Object.values(CHOICE_GROUPS)) {
    for (const id of ids) assert.ok(Object.hasOwn(CHOICE_CONTEXTS, id), `Missing conversation context for ${id}`);
  }
});

test("a fresh connection only offers questions that need no prior explanation", () => {
  const game = start();
  assert.deepEqual(game.sharedTopics, []);
  assert.deepEqual(choiceIds(game), ["hello", "name", "incident", "location"]);
  for (const id of ["reassure", "break_door", "escape", "power_location", "tank_question", "other_people"]) {
    assert.ok(!choiceIds(game).includes(id), `${id} should not precede its subject`);
  }
});

test("the urgent welcome introduces escape but does not invent a locked door or blackout", () => {
  for (const action of ["hello", "name"]) {
    const game = choose(start(), action);
    const ids = choiceIds(game);
    for (const id of ["escape", "other_people"]) assert.ok(ids.includes(id));
    for (const id of ["reassure", "break_door", "power_location", "tank_question"]) assert.ok(!ids.includes(id));
    assert.ok(game.sharedTopics.includes("deadline"));
    assert.ok(!game.sharedTopics.includes("closed_door"));
  }
});

test("the incident explains the blackout and tank, but F01 is not evidence of a closed door", () => {
  const game = choose(start(), "incident");
  assert.ok(game.knownFacts.includes("F01"));
  for (const id of ["power_location", "tank_question", "escape"]) assert.ok(choiceIds(game).includes(id));
  assert.ok(!choiceIds(game).includes("reassure"));
  assert.ok(!choiceIds(game).includes("break_door"));
  assert.ok(!game.sharedTopics.includes("closed_door"));
});

test("a location answer reveals the closed door without implying an unexplained deadline", () => {
  let game = choose(start(), "location");
  for (const id of ["escape", "break_door", "other_people"]) assert.ok(choiceIds(game).includes(id));
  for (const id of ["reassure", "power_location", "tank_question"]) assert.ok(!choiceIds(game).includes(id));
  game = choose(game, "escape");
  assert.ok(choiceIds(game).includes("power_location"));
  assert.ok(game.sharedTopics.includes("emergency_power"));
});

test("talking about the door gives a complete exploration route without requiring the incident question", () => {
  let game = start();
  for (const id of ["location", "break_door", "go_machine", "find_code", "enable_power"]) game = choose(game, id);
  assert.equal(game.powerEnabled, true);
  assert.ok(choiceIds(game).includes("security"));
  assert.ok(choiceIds(game).includes("inspect_controls"));
  assert.ok(!choiceIds(game).includes("tank"), "The named tank has not been introduced");
  game = choose(game, "security");
  assert.ok(choiceIds(game).includes("tank"), "The recording now introduces TANK-07");
  assert.equal(getChoices(game).find((choice) => choice.id === "next_security")?.label, "次の映像を見る");
  assert.ok(!game.messages.some((message) => message.text.includes("5 MIN BEFORE")));
  game = choose(game, "next_security");
  assert.ok(game.messages.some((message) => message.text.includes("5 MIN BEFORE")));
});

test("reassurance remains absent from choices even after suspicion or direct reassurance", () => {
  let game = say(start(), "7319");
  assert.ok(game.sharedTopics.includes("suspicion"));
  assert.ok(!choiceIds(game).includes("reassure"));
  game = say(game, "信じて");
  assert.equal(game.trustYuna, 0);
  assert.ok(!choiceIds(game).includes("reassure"));
  assert.ok(!choiceIds(nextLoop(game)).includes("reassure"));
});

test("current dialogue context resets, while correct recorded shortcuts remain available", () => {
  let game = powerByDiscovery();
  game = say(game, "隔離プロトコルを解除");
  assert.ok(game.sharedTopics.length > 0);
  game = nextLoop(game);
  assert.deepEqual(game.sharedTopics, []);
  assert.ok(choiceIds(game).includes("go_machine"));
  for (const id of ["reassure", "break_door", "power_location"]) assert.ok(!choiceIds(game).includes(id));
  assert.ok(choiceIds(game).includes("tank_question"), "The subject remains known, without inventing a current emergency");
  game = choose(game, "go_machine");
  game = choose(game, "enable_power");
  assert.ok(choiceIds(game).includes("central"));
  assert.ok(choiceIds(game).includes("stop_pump"));
  assert.ok(choiceIds(game).includes("request_release"));
});

test("context controls suggestions only, so hidden but meaningful direct inputs still work", () => {
  for (const [input, action] of [["信じて。時間がない", "reassure"], ["扉を壊せない？", "break_door"], ["非常電源はどこ？", "power_location"], ["水槽07って何？", "tank_question"]]) {
    const before = start();
    assert.ok(!choiceIds(before).includes(action));
    const game = say(before, input);
    assert.ok(game.completedActions.includes(action));
    assert.ok(game.messages.length > before.messages.length);
    assert.ok(game.remaining < before.remaining);
  }
  for (const input of ["次の映像を見る", "5分前"]) {
    const before = say(start(), "7319");
    assert.ok(!choiceIds(before).includes("next_security"));
    const game = say(before, input);
    assert.ok(game.completedActions.includes("next_security"));
    assert.ok(game.knownFacts.includes("F13"));
  }
  assert.equal(clearByKnownCommands(start()).ending, "secret");
});

test("timer announcements introduce urgency but never fabricate the closed-door conversation", () => {
  const game = advanceTime(start(), 120);
  assert.ok(game.sharedTopics.includes("deadline"));
  assert.ok(!choiceIds(game).includes("reassure"));
  assert.ok(!choiceIds(game).includes("break_door"));
});

test("a current machine location and F01 in prior records do not imply a newly reported locked door", () => {
  const saved = startGame({ ...createGame(), knownFacts: ["F01", "F02", "F03"], loopCount: 2 });
  assert.ok(!choiceIds(saved).includes("break_door"));
  let game = say(saved, "7319");
  game = choose(game, "location");
  assert.ok(!game.sharedTopics.includes("closed_door"));
  assert.ok(!choiceIds(game).includes("open_door"));
  game = choose(game, "escape");
  assert.ok(choiceIds(game).includes("open_door"));
});

test("a pressure-control capability is not evidence of a pressure abnormality", () => {
  let game = say(start(), "7319");
  game = say(game, "中央管理端末");
  assert.ok(game.sharedTopics.includes("pressure"));
  assert.ok(!game.sharedTopics.includes("pressure_abnormal"));
  assert.ok(!choiceIds(game).includes("pressure_details"));
  game = choose(game, "pressure");
  assert.ok(game.sharedTopics.includes("pressure_abnormal"));
  assert.ok(choiceIds(game).includes("pressure_details"));
  game = choose(game, "stop_pump");
  assert.equal(getChoices(game).find((choice) => choice.id === "pressure_details")?.label, "圧力が異常になる理由は？");
});

test("a real pressure alarm allows an informed pressure question without navigating a diagnostic menu", () => {
  let game = say(start(), "7319");
  assert.ok(!choiceIds(game).includes("pressure_details"));
  game = advanceTime(game, game.remaining - 120);
  assert.ok(game.sharedTopics.includes("pressure_abnormal"));
  assert.ok(choiceIds(game).includes("pressure_details"));
});

test("hearing an audio log does not pretend the live tank image has already been opened", () => {
  let game = say(start(), "7319");
  game = say(game, "音声ログ");
  assert.ok(game.sharedTopics.includes("tank07"));
  assert.ok(!game.sharedTopics.includes("tank_feed"));
  assert.ok(choiceIds(game).includes("tank"));
  assert.ok(!choiceIds(game).includes("brighten"));
  game = choose(game, "tank");
  assert.ok(choiceIds(game).includes("brighten"));
});

test("the tank explains its tools before suggesting them and remembers the methods across connections", () => {
  let game = powerByDiscovery();
  for (const id of ["audio", "vitals", "brighten"]) assert.ok(!choiceIds(game).includes(id));
  const before = game;
  game = choose(game, "tank");
  assert.match(newText(before, game), /生体センサー.*事故前の録音/);
  assert.match(newText(before, game), /明るさ/);
  assert.ok(game.knownFacts.includes("F07"));
  assert.ok(!game.knownFacts.includes("F10") && !game.knownFacts.includes("F14"));
  for (const id of ["audio", "vitals", "brighten"]) assert.ok(choiceIds(game).includes(id));

  game = nextLoop(game);
  for (const id of ["audio", "vitals", "tank"]) assert.ok(!choiceIds(game).includes(id), "Unpowered equipment is still unavailable");
  game = say(game, "7319");
  for (const id of ["audio", "vitals", "tank"]) assert.equal(getChoices(game).find((choice) => choice.id === id)?.fromRecord, true);
  assert.ok(!choiceIds(game).includes("brighten"), "There is no current image to brighten");
  game = choose(game, "audio");
  game = choose(game, "vitals");
  assert.ok(game.knownFacts.includes("F10") && game.knownFacts.includes("F14"));
});

test("the tank's name persists separately from current danger and undiscovered research tools", () => {
  let game = choose(start(), "incident");
  assert.ok(game.knownFacts.includes("F06"));
  game = nextLoop(game);
  assert.deepEqual(game.sharedTopics, []);
  assert.ok(choiceIds(game).includes("tank_question"));
  for (const id of ["break_door", "escape", "power_location"]) assert.ok(!choiceIds(game).includes(id));
  game = say(game, "7319");
  assert.ok(choiceIds(game).includes("tank"));
  for (const id of ["audio", "vitals", "brighten"]) assert.ok(!choiceIds(game).includes(id));
});

test("old saved facts restore only investigation methods that those facts actually demonstrate", () => {
  for (const [fact, visible, hidden] of [
    ["F10", "audio", "vitals"], ["F11", "audio", "vitals"],
    ["F14", "vitals", "audio"], ["F20", "history", "signal"],
  ]) {
    const saved = startGame({ ...createGame(), loopCount: 2, knownFacts: [fact] });
    const game = say(saved, "7319");
    assert.equal(getChoices(game).find((choice) => choice.id === visible)?.fromRecord, true);
    assert.ok(!choiceIds(game).includes(hidden));
    assert.ok(!choiceIds(game).includes("brighten"));
  }
});

test("communications introduces diagnostic methods before showing them and retains them after reconnect", () => {
  let game = say(start(), "7319");
  game = say(game, "中央管理端末");
  for (const id of ["history", "signal"]) assert.ok(!choiceIds(game).includes(id));
  const before = game;
  game = choose(game, "comms");
  assert.match(newText(before, game), /施設の時計.*発信元/);
  assert.ok(game.knownFacts.includes("F08"));
  assert.ok(!game.knownFacts.includes("F20"));
  for (const id of ["history", "signal"]) assert.ok(choiceIds(game).includes(id));
  game = say(nextLoop(game), "7319");
  for (const id of ["comms", "history", "signal"]) assert.equal(getChoices(game).find((choice) => choice.id === id)?.fromRecord, true);
  game = choose(game, "history");
  game = choose(game, "signal");
  assert.ok(game.knownFacts.includes("F20"));
});

function trustedRecordConnection(): GameState {
  let game = say(start(), "7319");
  game = choose(game, "security");
  return choose(game, "next_security");
}

test("identity dialogue introduces unexamined research without awarding its results and guides unpowered rescue", () => {
  let game = choose(start(), "hello");
  const before = game;
  game = say(game, "君、本当にユナ？");
  assert.match(newText(before, game), /生体センサー.*事故前の録音/);
  assert.match(newText(before, game), /第2機械室の非常電源/);
  assert.ok(game.knownFacts.includes("F07") && game.knownFacts.includes("F02"));
  for (const id of ["F10", "F11", "F14"]) assert.ok(!game.knownFacts.includes(id));
  assert.ok(choiceIds(game).includes("go_machine"));
  assert.ok(!choiceIds(game).includes("audio"));
});

test("identity guidance follows the actual power, directory, central-control and pump state", () => {
  const cases: { setup: string[]; text: RegExp; next: string }[] = [
    { setup: [], text: /設備の一覧/, next: "inspect_controls" },
    { setup: ["inspect_controls"], text: /中央管理端末.*接続/, next: "central" },
    { setup: ["inspect_controls", "central"], text: /圧力制御.*手順/, next: "pressure" },
    { setup: ["inspect_controls", "central", "pressure"], text: /先に第7区画の排水ポンプを止めて/, next: "stop_pump" },
  ];
  for (const entry of cases) {
    let game = trustedRecordConnection();
    for (const id of entry.setup) game = choose(game, id);
    const before = game;
    game = choose(game, "question_identity");
    assert.match(newText(before, game), entry.text);
    game = choose(game, entry.next);
    assert.equal(game.status, "playing");
  }
  let game = trustedRecordConnection();
  game = say(game, "第7区画の排水ポンプを停止");
  assert.ok(!game.knownFacts.includes("F04"));
  const before = game;
  game = choose(game, "question_identity");
  assert.match(newText(before, game), /ポンプを止める手順は済んだ/);
  assert.ok(choiceIds(game).includes("request_release"));
  game = choose(game, "request_release");
  game = choose(game, "release");
  assert.equal(game.ending, "secret");
});

test("identity questioning during release confirmation preserves the final confirmation when drainage is off", () => {
  let game = trustedRecordConnection();
  game = say(game, "第7区画の排水ポンプを停止");
  game = say(game, "隔離プロトコルを解除");
  const before = game;
  game = say(game, "君、本当にユナ？");
  assert.equal(game.scene, "release_confirm");
  assert.match(newText(before, game), /『開ける』を選んで/);
  for (const id of ["audio", "vitals"]) assert.ok(choiceIds(game).includes(id), "Research mentioned in the reply remains selectable");
  game = choose(game, "release");
  assert.equal(game.ending, "secret");
});

test("unresolved research after an identity question at release confirmation can be completed using buttons", () => {
  let game = trustedRecordConnection();
  game = say(game, "第7区画の排水ポンプを停止");
  game = say(game, "隔離プロトコルを解除");
  game = say(game, "君、本当にユナ？");
  for (const id of ["audio", "vitals", "request_release", "release"]) game = choose(game, id);
  assert.equal(game.ending, "secret");
  for (const id of ["F10", "F11", "F14", "F21"]) assert.ok(game.knownFacts.includes(id));
});

test("identity guidance does not repeat resolved research or recommend truth dialogue after refusal", () => {
  let game = trustedRecordConnection();
  game = say(game, "音声ログ");
  game = say(game, "生体反応は？");
  let before = game;
  game = choose(game, "question_identity");
  assert.doesNotMatch(newText(before, game), /生体センサーと事故前の録音/);
  game = say(start(), "7319");
  before = game;
  game = say(game, "君、本当にユナ？");
  assert.equal(game.truthClosed, true);
  assert.doesNotMatch(newText(before, game), /生体センサーと事故前の録音/);
  assert.match(newText(before, game), /設備の一覧/);
  assert.ok(choiceIds(game).includes("inspect_controls"));
  assert.ok(!choiceIds(game).includes("audio"));
});

test("NORMAL leaves an unresolved question that matches the information still missing", () => {
  for (const [research, expected] of [
    [[], /水槽07の事故前の録音/],
    [["音声ログ"], /水槽07の生体センサー/],
    [["音声ログ", "生体反応は？"], /事故前のユナを映す監視記録/],
    [["音声ログ", "生体反応は？", "監視ログ", "5分前"], /記録に映ったユナと、この回線のユナ/],
  ] as [string[], RegExp][]) {
    let game = say(start(), "7319");
    for (const input of research) game = say(game, input);
    game = nextLoop(game);
    const before = game;
    game = clearByKnownCommands(game);
    assert.equal(game.ending, "normal");
    assert.match(newText(before, game), expected);
    assert.match(newText(before, game), /まだ、違う答えがある/);
    assert.equal(game.messages.at(-1)?.text, "CONNECTION TERMINATED");
  }
});

test("a NORMAL hint records only the investigation method it actually introduces", () => {
  let game = clearByKnownCommands(nextLoop(start()));
  assert.ok(game.knownFacts.includes("F09"));
  assert.ok(!game.knownFacts.includes("F07") && !game.knownFacts.includes("F15"));
  assert.ok(!game.knownFacts.includes("F10") && !game.knownFacts.includes("F14"));
  game = say(reconnect(game), "7319");
  assert.equal(getChoices(game).find((choice) => choice.id === "audio")?.fromRecord, true);
  assert.ok(!choiceIds(game).includes("vitals"));
  game = choose(game, "audio");
  game = clearByKnownCommands(game);
  assert.equal(game.ending, "normal");
  assert.ok(game.knownFacts.includes("F15"));
  assert.ok(!game.knownFacts.includes("F14"));
  game = say(reconnect(game), "7319");
  assert.equal(getChoices(game).find((choice) => choice.id === "vitals")?.fromRecord, true);
  game = choose(game, "vitals");
  assert.ok(game.knownFacts.includes("F14"));
});

test("free-input flavor replies are bounded and never award trust, knowledge, or physical progress", () => {
  for (const input of ["ＳＯＳ", "ありがとう", "こんにちは", "水槽０８"]) {
    let game = start();
    for (let repeat = 0; repeat < 3; repeat++) {
      const before = game;
      game = say(game, input);
      assert.equal(game.remaining, before.remaining - 2);
      assert.ok(game.messages.length > before.messages.length + 1);
      assert.deepEqual(game.knownFacts, []);
      assert.equal(game.trustYuna, 0);
      assert.equal(game.powerEnabled, false);
      assert.equal(game.echoPending, false);
      assert.equal(game.ending, null);
    }
  }
  const late = advanceTime(start(), 178);
  const expired = say(late, "ありがとう");
  assert.equal(expired.status, "disconnected");
  assert.doesNotMatch(newText(late, expired), /今は、一緒にここから出よう/);
});

test("the two explicit free-input phrases reach ECHO with no discoveries or power", () => {
  let game = start();
  game = say(game, ECHO_INPUT.request);
  assert.equal(game.echoPending, true);
  assert.equal(game.remaining, 177);
  assert.deepEqual(choiceIds(game), ["cancel_echo"]);
  assert.match(game.messages.at(-1)?.text ?? "", /通信を終了.*次の再構築/);
  game = say(game, ECHO_INPUT.confirm);
  assert.equal(game.ending, "echo");
  assert.equal(game.status, "ending");
  assert.equal(game.remaining, 171);
  assert.equal(game.echoPending, false);
  assert.equal(game.powerEnabled, false);
  assert.equal(game.containmentReleased, false);
  assert.equal(game.trustYuna, 0);
  assert.deepEqual(game.knownFacts, []);
  assertChronological(game);
  assert.deepEqual(advanceTime(game, 100), game);
  assert.deepEqual(say(game, "7319"), game);
});

test("ECHO requires the same-connection request and cannot be confirmed by a button action", () => {
  let game = say(start(), ECHO_INPUT.confirm);
  assert.equal(game.ending, null);
  assert.equal(game.echoPending, false);
  assert.match(game.messages.at(-1)?.text ?? "", /要求は受信していません/);
  game = say(game, ECHO_INPUT.request);
  for (const action of [ECHO_INPUT.confirm, "echo", "release", "hello"]) {
    const before = game;
    game = performAction(game, action);
    assert.equal(game.ending, null);
    assert.equal(game.echoPending, true);
    assert.ok(game.messages.length > before.messages.length);
  }
  game = say(game, ECHO_INPUT.confirm);
  assert.equal(game.ending, "echo");
});

test("unrecognized and normal inputs during ECHO confirmation respond without executing unrelated actions", () => {
  let game = say(start(), ECHO_INPUT.request);
  for (const input of ["違う言葉", "7319", "こんにちは", ECHO_INPUT.request]) {
    const before = game;
    game = say(game, input);
    assert.equal(game.echoPending, true);
    assert.equal(game.powerEnabled, false);
    assert.equal(game.ending, null);
    assert.equal(game.remaining, before.remaining - 2);
    assert.ok(game.messages.length > before.messages.length);
    assert.equal(game.messages.at(-1)?.speaker, "SYSTEM");
  }
  game = choose(game, "cancel_echo");
  assert.equal(game.echoPending, false);
  assert.ok(game.selectedActions.includes("cancel_echo"));
  assert.ok(!game.completedActions.includes("cancel_echo"));
  assert.deepEqual(choiceIds(game), ["hello", "name", "incident", "location"]);
  game = say(game, "7319");
  assert.equal(game.powerEnabled, true);
});

test("ECHO cancellation restores an existing containment confirmation without losing physical progress", () => {
  for (const input of ["取消", "取り消し", "キャンセル", "やめる"]) {
    let game = say(start(), "7319");
    game = say(game, "第7区画の排水ポンプを停止");
    game = say(game, "隔離プロトコルを解除");
    game = say(game, ECHO_INPUT.request);
    game = say(game, input);
    assert.equal(game.echoPending, false);
    assert.equal(game.scene, "release_confirm");
    assert.equal(game.drainageDisabled, true);
    assert.equal(game.doomed, null);
    game = choose(game, "release");
    assert.equal(game.ending, "secret");
  }
});

test("the ECHO request and confirmation must both finish before the deadline", () => {
  let game = advanceTime(start(), 177);
  game = say(game, ECHO_INPUT.request);
  assert.equal(game.status, "disconnected");
  assert.equal(game.echoPending, false);
  for (const remaining of [6, 7]) {
    game = say(start(), ECHO_INPUT.request);
    game = advanceTime(game, game.remaining - remaining);
    game = say(game, ECHO_INPUT.confirm);
    assert.equal(game.echoPending, false);
    assert.equal(game.status, remaining === 6 ? "disconnected" : "ending");
    assert.equal(game.ending, remaining === 6 ? null : "echo");
    assertChronological(game);
  }
});

test("ECHO pending consent expires on timeout, reconnect, and fresh restored sessions", () => {
  let game = say(start(), ECHO_INPUT.request);
  game = advanceTime(game, 180);
  assert.equal(game.echoPending, false);
  game = reconnect(game);
  assert.equal(game.echoPending, false);
  game = say(game, ECHO_INPUT.confirm);
  assert.equal(game.ending, null);
  game = say(game, ECHO_INPUT.request);
  const restored = startGame({ ...createGame(), loopCount: 3, knownFacts: [...game.knownFacts] });
  assert.equal(restored.echoPending, false);
  assert.equal(say(restored, ECHO_INPUT.confirm).ending, null);
  game = say(game, ECHO_INPUT.confirm);
  game = reconnect(game);
  assert.equal(game.echoPending, false);
  assert.equal(game.remaining, 180);
  assert.equal(game.ending, null);
});

test("ECHO cannot escape a doomed connection or interrupt the final UNKNOWN conversation", () => {
  let game = say(start(), "7319");
  game = say(game, "第4区画の扉を開けて");
  game = say(game, ECHO_INPUT.request);
  assert.equal(game.echoPending, false);
  assert.equal(game.doomed, "escape");
  const failed = advanceTime(game, 180);
  assert.deepEqual(say(failed, ECHO_INPUT.request), failed);

  game = collectTankFacts(start());
  game = collectIdentityFacts(nextLoop(game));
  game = clearByKnownCommands(nextLoop(game));
  assert.equal(game.scene, "unknown");
  for (const input of [ECHO_INPUT.request, ECHO_INPUT.confirm, "こんにちは"]) {
    const before = game;
    game = say(game, input);
    assert.equal(game.echoPending, false);
    assert.equal(game.remaining, before.remaining);
    assert.equal(game.messages.at(-1)?.speaker, "UNKNOWN");
  }
  game = choose(game, "unknown_identity");
  assert.equal(game.ending, "true");
});

test("free-input secrets appear in diagnostic dialogue, never in action labels, keywords, or memory completion", () => {
  const listed = [
    ...Object.values(ACTIONS).map((action) => action.label),
    ...Object.values(KEYWORDS).flat(),
    ...Object.values(FACTS).flatMap((fact) => fact.keyword ? [fact.keyword] : []),
  ];
  for (const secret of [ECHO_INPUT.request, ECHO_INPUT.confirm, ...FREE_REPLIES.flatMap((entry) => entry.aliases)]) {
    assert.ok(!listed.includes(secret), `${secret} must remain free input only`);
  }
  let game = say(start(), "7319");
  const before = game;
  game = say(game, "通信履歴");
  game = choose(game, "signal");
  assert.match(newText(before, game), /応答を引き継ぐ/);
  assert.match(newText(before, game), /私がユナです/);
  assert.equal(game.echoPending, false);
});

test("selected conversation and research choices remain readable without repeating trust rewards", () => {
  let game = choose(start(), "hello");
  let choice = getChoices(game).find((item) => item.id === "hello");
  assert.equal(choice?.selected, true);
  assert.equal(choice?.cost, 2);
  const helloTrust = game.trustYuna;
  game = choose(game, "hello");
  assert.equal(game.trustYuna, helloTrust);
  game = say(game, "7319");
  game = choose(game, "security");
  choice = getChoices(game).find((item) => item.id === "security");
  assert.equal(choice?.selected, true);
  const before = game;
  game = choose(game, "security");
  assert.equal(game.remaining, before.remaining - choice!.cost);
  assert.equal(game.trustYuna, before.trustYuna);
  assert.deepEqual(game.knownFacts, before.knownFacts);
  assert.equal(game.selectedActions.filter((id) => id === "security").length, 1);
  assert.ok(getChoices(game).some((item) => item.id === "next_security" && !item.selected));
});

test("selection history survives reconnect while current actions, trust, and first-read costs reset", () => {
  let game = choose(start(), "hello");
  game = say(game, "7319");
  game = choose(game, "security");
  game = nextLoop(game);
  assert.deepEqual(game.completedActions, []);
  assert.equal(game.trustYuna, 0);
  assert.equal(game.powerEnabled, false);
  const hello = getChoices(game).find((item) => item.id === "hello");
  assert.equal(hello?.selected, true);
  assert.equal(hello?.cost, ACTIONS.hello.cost);
  game = choose(game, "hello");
  assert.equal(game.trustYuna, 1);
  game = choose(game, "go_machine");
  const power = getChoices(game).find((item) => item.id === "enable_power");
  assert.equal(power?.selected, true);
  game = choose(game, "enable_power");
  assert.equal(game.powerEnabled, true);
  assert.ok(!choiceIds(game).includes("enable_power"));
  assert.ok(!choiceIds(game).includes("go_machine"));
  const security = getChoices(game).find((item) => item.id === "security");
  assert.equal(security?.selected, true);
  assert.equal(security?.cost, ACTIONS.security.cost);
});

test("selection markers neither unlock undiscovered choices nor mark unfinished operations as read", () => {
  const recorded = startGame({ ...createGame(), selectedActions: Object.keys(ACTIONS) });
  assert.deepEqual(choiceIds(recorded), choiceIds(start()));
  assert.deepEqual(recorded.knownFacts, []);
  assert.ok(getChoices(recorded).every((item) => item.selected));
  const unpowered = say(start(), "音声ログ");
  assert.ok(!unpowered.selectedActions.includes("audio"));
  const notConnected = say(start(), "君は水槽07？");
  assert.ok(!notConnected.selectedActions.includes("unknown_identity"));
  assert.ok(!notConnected.completedActions.includes("unknown_identity"));
  let late = say(start(), "7319");
  late = advanceTime(late, late.remaining - ACTIONS.security.cost);
  late = say(late, "監視ログ");
  assert.equal(late.status, "disconnected");
  assert.ok(!late.selectedActions.includes("security"));
  assert.deepEqual(createGame().selectedActions, []);
});

test("a release warning is remembered as selected without completing the release", () => {
  let game = say(start(), "7319");
  game = say(game, "隔離プロトコルを解除");
  assert.ok(game.selectedActions.includes("request_release"));
  assert.ok(!game.selectedActions.includes("release"));
  assert.equal(game.containmentReleased, false);
  game = nextLoop(game);
  game = say(game, "7319");
  assert.equal(getChoices(game).find((item) => item.id === "request_release")?.selected, true);
  assert.equal(getChoices(game).find((item) => item.id === "request_release")?.cost, ACTIONS.request_release.cost);
});
