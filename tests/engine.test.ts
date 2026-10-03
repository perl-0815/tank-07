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

function start(): GameState {
  return startGame(createGame());
}

function say(state: GameState, text: string): GameState {
  return submitKeyword(state, text);
}

function choose(state: GameState, id: string): GameState {
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
  assert.ok(getChoices(game).length > 4);
  assert.ok(getChoices(game).some((choice) => choice.id === "power_location"));
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
  state = say(state, "7319");
  state = choose(state, "tank");
  state = choose(state, "vitals");
  state = choose(state, "brighten");
  return choose(state, "audio");
}

function collectIdentityFacts(state: GameState): GameState {
  state = choose(state, "hello");
  state = say(state, "信じて。時間がない");
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
  game = say(game, "信じて。時間がない");
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
  assert.equal(choice("inspect_controls"), undefined);
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
    "hello", "power_location", "go_machine", "find_code", "enable_power",
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
  for (const action of ["power_location", "go_machine", "find_code", "enable_power", "inspect_controls", "central", "pressure"]) {
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
  for (const action of ["hello", "power_location", "go_machine", "find_code", "enable_power"]) game = choose(game, action);
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

test("reassurance can recover trust after an unexplained code without repeating the introduction", () => {
  let game = say(start(), "7319");
  const before = game;
  game = say(game, "聞こえる");
  assert.doesNotMatch(newText(before, game), /通信が全部死んでる|あと数分/);
  game = choose(game, "reassure");
  assert.equal(game.trustYuna, 0);
  game = choose(game, "reassure");
  assert.equal(game.trustYuna, 1);
  game = choose(game, "security");
  game = choose(game, "next_security");
  game = choose(game, "question_identity");
  assert.ok(game.knownFacts.includes("F21"));
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
  }
});
