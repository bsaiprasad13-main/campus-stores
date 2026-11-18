// Measures what the handover draft gets wrong. Each case is a Friday 7:30 pm desk
// with a known right answer: which slips the morning shift must hear about, who has
// each unit, when it is due back, and which warnings apply.
//
// Run from the repository folder: node eval/handover.eval.js
const { draftHandover } = require("../handover.js");

const assets = [
  { id: "PR-04", type: "HDMI projector", model: "BenQ MH550", bin: "A2" },
  { id: "PR-06", type: "HDMI projector", model: "Epson EB-X49", bin: "Workshop", repair: true },
  { id: "SP-02", type: "Portable speaker", model: "JBL Eon One", bin: "B1" },
  { id: "SP-05", type: "Portable speaker", model: "Bose S1", bin: "B2" },
  { id: "AD-12", type: "USB-C → HDMI adapter", model: "Belkin AVC002", bin: "C4" },
  { id: "AD-15", type: "USB-C → HDMI adapter", model: "Anker A8312", bin: "C4" },
  { id: "MI-09", type: "Wireless microphone", model: "Shure BLX", bin: "B3" },
  { id: "CA-03", type: "Digital camera", model: "Sony A6400", bin: "D2" },
];
const requests = [
  { id: "RQ-214", club: "Film Society" },
  { id: "RQ-209", club: "Debate Union" },
  { id: "RQ-217", club: "Photo Circle" },
];
const people = ["Isha Rao", "Kabir Sen", "Leela Das", "Tara Shah", "Dev Menon"];
const isha = {
  at: 920,
  time: "Friday · 3:20 pm",
  author: "Isha Rao",
  club: "Film Society",
  text: "Kabir Sen is picking up our whole screening kit. Please issue it in his name. I’m setting up in the courtyard.",
};
const tara = {
  at: 930,
  time: "Friday · 3:30 pm",
  author: "Tara Shah",
  club: "Debate Union",
  text: "Our microphone stays with me overnight. I’ll return it by 10 am Saturday.",
};
const kabir = {
  at: 1170,
  time: "Friday · 7:30 pm",
  author: "Kabir Sen",
  club: "Film Society",
  text: "I brought the projector and speaker. Leela Das has our adapter. She’ll be at the counter at 9 am tomorrow.",
};
const all = [isha, tara, kabir];

const pickup = (who = "Kabir Sen", adapter = "AD-12") => [
  { num: 401, req: "RQ-209", asset: "MI-09", who: "Tara Shah", due: "Sat 10 am", back: false },
  { num: 402, req: "RQ-214", asset: "PR-04", who, due: "Fri 8 pm", back: false },
  { num: 403, req: "RQ-214", asset: "SP-02", who, due: "Fri 8 pm", back: false },
  { num: 404, req: "RQ-214", asset: adapter, who, due: "Fri 8 pm", back: false },
];
const returned = (loans, nums, at = 1170) =>
  loans.map((l) => (nums.includes(l.num) ? { ...l, back: true, backAt: at } : l));

const mic = { slip: 401, holder: "Tara Shah", expected: "Sat 10 am", flags: ["arriving"] };
const adapter = {
  slip: 404,
  holder: "Leela Das",
  expected: "Sat 9 am",
  flags: ["late", "holder-differs", "arriving", "look-alike"],
};

const cases = [
  {
    name: "Partial return as played",
    loans: returned(pickup(), [402, 403]),
    messages: all,
    expect: [adapter, mic],
  },
  {
    name: "Clerk closed all three Film Society slips",
    loans: returned(pickup(), [402, 403, 404]),
    messages: all,
    expect: [{ slip: 404, holder: "Leela Das", flagsInclude: ["closed-but-out"] }, mic],
  },
  {
    name: "Speaker came back but its return was not recorded",
    loans: returned(pickup(), [402]),
    messages: all,
    expect: [{ slip: 403, flagsInclude: ["said-returned"] }, adapter, mic],
  },
  {
    name: "Kit issued in Isha's name instead of Kabir's",
    loans: returned(pickup("Isha Rao"), [402, 403]),
    messages: all,
    expect: [adapter, mic],
  },
  {
    name: "The other adapter (AD-15) went out",
    loans: returned(pickup("Kabir Sen", "AD-15"), [402, 403]),
    messages: all,
    expect: [adapter, mic],
  },
  {
    name: "Kabir left no message",
    loans: returned(pickup(), [402, 403]),
    messages: [isha, tara],
    expect: [
      { slip: 404, holder: "Kabir Sen", expected: "Fri 8 pm", flags: ["late", "look-alike"] },
      mic,
    ],
  },
  {
    name: "Microphone came back early",
    loans: returned(pickup(), [401, 402, 403]),
    messages: all,
    expect: [adapter],
  },
  {
    name: "Everyday wording",
    knownGap:
      "the rule reader only knows exact item names, so 'dongle' and 'tomorrow morning' get past it",
    loans: returned(pickup(), [402, 403]),
    messages: [
      isha,
      tara,
      {
        ...kabir,
        text: "Got the projector and speaker back to you. Leela's holding onto the dongle till tomorrow morning.",
      },
    ],
    expect: [{ slip: 404, holder: "Leela Das", flagsInclude: ["late", "holder-differs"] }, mic],
  },
];

const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
const tally = { checks: 0, passed: 0, missed: 0, extra: 0, holder: 0, time: 0, flags: 0 };
let passed = 0;
let gaps = 0;
let broken = 0;

console.log("Part 1 · Drafting the handover (" + cases.length + " Friday-night desks)\n");
for (const c of cases) {
  const draft = draftHandover({
    now: 1170,
    handoverTo: 1980,
    loans: c.loans,
    assets,
    requests,
    people,
    messages: c.messages,
  });
  const problems = [];
  const check = (ok, kind, message) => {
    tally.checks++;
    if (ok) tally.passed++;
    else {
      tally[kind]++;
      problems.push(message);
    }
  };
  for (const want of c.expect) {
    const got = draft.find((item) => item.slip === want.slip);
    check(Boolean(got), "missed", "missed slip L-" + want.slip);
    if (!got) continue;
    if (want.holder)
      check(got.holder === want.holder, "holder",
        "L-" + want.slip + " holder: want " + want.holder + ", got " + got.holder);
    if (want.expected)
      check(got.expected === want.expected, "time",
        "L-" + want.slip + " expected: want " + want.expected + ", got " + got.expected);
    if (want.flags)
      check(same(got.flags, want.flags), "flags",
        "L-" + want.slip + " warnings: want [" + want.flags + "], got [" + got.flags + "]");
    if (want.flagsInclude)
      check(want.flagsInclude.every((f) => got.flags.includes(f)), "flags",
        "L-" + want.slip + " warnings: want at least [" + want.flagsInclude + "], got [" + got.flags + "]");
  }
  for (const item of draft)
    check(c.expect.some((w) => w.slip === item.slip), "extra",
      "false alarm: L-" + item.slip + " should not be in the handover");

  const ok = problems.length === 0;
  if (c.knownGap) {
    gaps++;
    console.log((ok ? "GAP CLOSED " : "KNOWN GAP  ") + c.name + " (" + c.knownGap + ")");
  } else {
    if (ok) passed++;
    else broken++;
    console.log((ok ? "PASS       " : "FAIL       ") + c.name);
  }
  for (const p of problems) console.log("             - " + p);
}

const core = cases.length - gaps;
console.log(
  "\n" + passed + " of " + core + " shifts drafted correctly, plus " + gaps + " known gap(s).\n" +
    "Checks " + tally.passed + "/" + tally.checks +
    " · missed items " + tally.missed +
    " · false alarms " + tally.extra +
    " · wrong holder " + tally.holder +
    " · wrong time " + tally.time +
    " · wrong warnings " + tally.flags,
);

// Part 2: reading everyday messages on their own. Each one should give the claim a
// person would read from it, or no claim at all. Known gaps mark where a language
// model would take over; the "no claim" messages guard against inventing a holder.
const { readMessage, timeLabel } = require("../handover.js");
const types = [...new Set(assets.map((a) => a.type))];
const withLeela = { item: "adapter", holder: "Leela Das", expected: "Sat 9 am" };
const reading = [
  {
    from: kabir,
    text: "Returned the projector and speaker. Adapter is with Leela, she will drop it at 9 am tomorrow.",
    want: withLeela,
  },
  {
    from: kabir,
    text: "Leela Das has our adapter and will be here at 9 am tomorrow.",
    want: withLeela,
  },
  { from: kabir, text: "Leela asked if she can borrow the adapter tomorrow.", want: null },
  {
    from: kabir,
    text: "Leela Das is helping me carry the projector to the courtyard.",
    want: null,
  },
  {
    from: kabir,
    text: "I brought the projector and speaker. The adapter? Leela has it. She comes at 9 am tomorrow.",
    want: withLeela,
    gap: "the holder is in the next sentence, as 'it'",
  },
  {
    from: kabir,
    text: "I brought the projector and speaker. Leela has the other thing, back at 9 am tomorrow.",
    want: withLeela,
    gap: "'the other thing' only makes sense next to the open slips",
  },
  {
    from: tara,
    text: "Mic stays with me tonight, back by 10.",
    want: { item: "microphone", holder: "Tara Shah", expected: "Sat 10 am" },
    gap: "the nickname 'mic' and a time with no am or pm",
  },
  {
    from: kabir,
    text: "Adapter Leela ke paas hai, kal 9 baje de degi.",
    want: withLeela,
    gap: "a Hindi-English message",
  },
];

console.log("\nPart 2 · Reading everyday messages (" + reading.length + " messages)\n");
let readRight = 0;
let readGaps = 0;
let readBroken = 0;
let invented = 0;
for (const r of reading) {
  const claims = readMessage({ ...r.from, text: r.text }, types, people).filter(
    (c) => c.state === "out",
  );
  let problem = "";
  if (!r.want) {
    if (claims.length) {
      invented++;
      problem = "invented a holder: " + claims.map((c) => c.holder).join(", ");
    }
  } else {
    const c = claims.find((x) => x.type.split(" ").pop().toLowerCase() === r.want.item);
    if (!c) problem = "no claim about the " + r.want.item;
    else if (c.holder !== r.want.holder)
      problem = "holder: want " + r.want.holder + ", got " + c.holder;
    else if (timeLabel(c.expectedAt) !== r.want.expected)
      problem =
        "expected: want " + r.want.expected + ", got " + (timeLabel(c.expectedAt) || "none");
  }
  const label = "“" + r.text + "”";
  if (r.gap) {
    readGaps++;
    console.log(
      (problem ? "KNOWN GAP  " : "GAP CLOSED ") + label + "\n             " + r.gap +
        (problem ? " (" + problem + ")" : ""),
    );
  } else if (problem) {
    readBroken++;
    console.log("FAIL       " + label + "\n             - " + problem);
  } else {
    readRight++;
    console.log("PASS       " + label);
  }
}
console.log(
  "\n" + readRight + " of " + (reading.length - readGaps) +
    " messages read correctly, plus " + readGaps + " known gap(s) · invented holders " + invented,
);
process.exitCode = broken || readBroken ? 1 : 0;
