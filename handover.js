// Drafts the shift handover from the desk's own records: slips, units, requests and
// desk book messages. It is a pure function with no page or storage access, so the app
// and eval/handover.eval.js run exactly the same code.
//
// Messages are read by a small rule reader. In production this is the step a language
// model would take over, returning the same claim shape, and the eval would score it.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CampusHandover = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DAY = 1440; // desk times are minutes from Friday 00:00
  const ARRIVING = 120; // expected in the first two hours of the next shift

  function timeLabel(t) {
    if (!Number.isFinite(t)) return "";
    const day = t >= DAY ? "Sat" : "Fri";
    const m = t % DAY;
    const h = Math.floor(m / 60);
    const min = m % 60;
    if (h === 12 && !min) return day + " noon";
    return (
      day +
      " " +
      (((h + 11) % 12) + 1) +
      (min ? ":" + String(min).padStart(2, "0") : "") +
      (h < 12 ? " am" : " pm")
    );
  }

  function labelTime(label) {
    const m = /^(Fri|Sat) (?:(noon)|(\d{1,2})(?::(\d{2}))? (am|pm))$/.exec(
      String(label),
    );
    if (!m) return NaN;
    const day = m[1] === "Sat" ? DAY : 0;
    if (m[2]) return day + 720;
    return (
      day +
      ((Number(m[3]) % 12) + (m[5] === "pm" ? 12 : 0)) * 60 +
      (Number(m[4]) || 0)
    );
  }

  // A clock time in a sentence, resolved against when the message was written.
  function readTime(sentence, said) {
    const low = sentence.toLowerCase();
    const m = /\b(?:(noon)|(\d{1,2})(?::(\d{2}))?\s*(am|pm))\b/.exec(low);
    if (!m) return NaN;
    const mins = m[1]
      ? 720
      : ((Number(m[2]) % 12) + (m[4] === "pm" ? 12 : 0)) * 60 +
        (Number(m[3]) || 0);
    let day = said >= DAY ? DAY : 0;
    if (/\btomorrow\b/.test(low)) day += DAY;
    else if (/\b(saturday|sat)\b/.test(low)) day = DAY;
    else if (/\b(friday|fri)\b/.test(low)) day = 0;
    else if (day + mins < said && !/\b(today|tonight)\b/.test(low)) day += DAY;
    return day + mins;
  }

  const word = (type) => type.split(" ").pop().toLowerCase();
  const mentions = (low, person) =>
    [person, person.split(" ")[0]].some((n) =>
      new RegExp("\\b" + n.toLowerCase() + "\\b").test(low),
    );

  // Turns one message into claims about equipment: returned, or still out with a
  // holder and an expected time. Claims are evidence for the clerk, never edits.
  function readMessage(msg, types, people) {
    const claims = [];
    let last = null;
    for (const sentence of String(msg.text).split(/(?<=[.!?])\s+/)) {
      const low = sentence.toLowerCase().replace(/[’‘]/g, "'");
      const found = types.filter((t) =>
        new RegExp("\\b" + word(t) + "s?\\b").test(low),
      );
      const when = readTime(sentence, msg.at);
      if (!found.length) {
        // "She'll be at the counter at 9 am tomorrow." times the item just named.
        if (last && !Number.isFinite(last.expectedAt) && Number.isFinite(when)) {
          last.expectedAt = when;
          last.quote += " " + sentence;
        }
        last = null;
        continue;
      }
      last = null;
      const returned =
        /\b(brought|returned|dropped off|handed (it )?back|gave (it )?back)\b/.test(
          low,
        );
      const other = people.find((p) => p !== msg.author && mentions(low, p));
      // Someone else only holds it when the sentence says so ("has", "is with",
      // "kept"), so "Leela asked to borrow the adapter" does not make Leela the holder.
      const holds =
        /\b(has|have|had|got|holds|holding|kept|keeps|keeping|took|taken)\b|\b(is|are|stays|stay) with\b/.test(
          low,
        );
      const self = /\b(with me|i have|i've got|i still have|i'm keeping)\b/.test(
        low,
      );
      for (const type of found) {
        const claim = {
          type,
          author: msg.author,
          club: msg.club,
          at: msg.at,
          time: msg.time,
          quote: sentence,
        };
        if (returned) claims.push({ ...claim, state: "returned" });
        else if ((other && holds) || self) {
          last = {
            ...claim,
            state: "out",
            holder: self ? msg.author : other,
            expectedAt: when,
          };
          claims.push(last);
        }
      }
    }
    return claims;
  }

  // One item per slip the next shift has to act on. Flags:
  // late, arriving, holder-differs, look-alike, said-returned, closed-but-out.
  function draftHandover({ now, handoverTo, loans, assets, requests, people, messages }) {
    const types = [...new Set(assets.map((a) => a.type))];
    const claims = messages
      .filter((m) => m.at <= now)
      .flatMap((m) => readMessage(m, types, people));
    const items = [];
    for (const l of loans) {
      const a = assets.find((x) => x.id === l.asset);
      const r = requests.find((x) => x.id === l.req);
      if (!a || !r) continue;
      const about = claims.filter(
        (c) => c.type === a.type && (c.club === r.club || c.author === l.who),
      );
      const out = about
        .filter((c) => c.state === "out" && (!l.back || c.at >= l.backAt))
        .pop();
      const said = about
        .filter((c) => c.state === "returned" && (!out || c.at >= out.at))
        .pop();
      if (l.back && !out) continue;
      const dueAt = labelTime(l.due);
      const expectedAt =
        out && Number.isFinite(out.expectedAt) ? out.expectedAt : dueAt;
      const twins = assets.filter(
        (x) => x.id !== a.id && x.type === a.type && x.bin === a.bin,
      );
      const flags = [];
      const text = [];
      if (l.back) {
        flags.push("closed-but-out");
        text.push(
          "Slip L-" + l.num + " is closed, but the message below says " +
            out.holder + " still has it. Check bin " + a.bin + " for " + a.id + ".",
        );
      } else {
        text.push(
          "Slip L-" + l.num + " names " + l.who + ", due " + l.due + "." +
            (dueAt < now
              ? " It is overdue."
              : dueAt < handoverTo
                ? " It will be overdue when the next shift starts."
                : ""),
        );
        if (dueAt < handoverTo) flags.push("late");
      }
      if (out) {
        text.push(out.author + ", " + out.time + ": “" + out.quote + "”");
        if (out.holder !== l.who && !l.back) flags.push("holder-differs");
      }
      if (said && !l.back) {
        flags.push("said-returned");
        text.push(
          said.author + ", " + said.time + ": “" + said.quote + "” The slip is still open. Check bin " +
            a.bin + " and record the return if it is there.",
        );
      }
      if (!l.back && expectedAt >= handoverTo && expectedAt < handoverTo + ARRIVING)
        flags.push("arriving");
      if (twins.length) {
        flags.push("look-alike");
        text.push(
          twins.map((x) => x.id + " (" + x.model + ")").join(", ") +
            (twins.length > 1 ? " are" : " is") + " in the same bin, " + a.bin +
            ", as " + a.id + " (" + a.model + ").",
        );
      }
      // One sentence the next shift can act on; the lines in `text` are the records behind it.
      const holder = out ? out.holder : l.who;
      const when = timeLabel(expectedAt) || String(l.due);
      const tagCheck = twins.length
        ? " Check the tag says " + a.id + ", not " + twins.map((x) => x.id).join(" or ") + "."
        : "";
      let action;
      if (l.back)
        action = holder + " still has it, but the slip is closed. Check bin " + a.bin + " for " + a.id + ".";
      else if (said)
        action = said.author + " says it came back. Check bin " + a.bin + " and record the return." + tagCheck;
      else if (out && Number.isFinite(out.expectedAt))
        action = holder + " brings it back " + when + "." + tagCheck;
      else if (dueAt < now)
        action = "Overdue since " + l.due + " and still with " + holder + ". Chase it." + tagCheck;
      else if (dueAt < handoverTo)
        action = "Due " + l.due + ", before the next shift starts. Chase " + holder + " if it is not back." + tagCheck;
      else action = holder + " is due to bring it back by " + l.due + "." + tagCheck;
      items.push({
        slip: l.num,
        unit: a.id,
        holder,
        expected: when,
        bin: a.bin,
        action,
        flags,
        title: a.id + " · " + a.type + " · " + r.club + " (" + r.id + ")",
        text,
        rank: l.back ? 0 : said ? 1 : flags.includes("late") ? 2 : flags.includes("arriving") ? 3 : 4,
        at: expectedAt,
      });
    }
    return items
      .sort((x, y) => x.rank - y.rank || x.at - y.at)
      .map(({ rank, at, ...item }) => item);
  }

  return { draftHandover, readMessage, timeLabel, labelTime };
});
