(() => {
  const storageKey = "campus-stores.shift.v1";
  const root = document.getElementById("campus-stores");
  const q = (selector) => root.querySelector(selector);
  const requests = [
    {
      id: "RQ-214",
      club: "Film Society",
      event: "Courtyard screening",
      owner: "Isha Rao",
      due: "Fri 8 pm",
      items: ["HDMI projector", "Portable speaker", "USB-C → HDMI adapter"],
      note: "Playback is from a USB-C-only laptop. The host will collect at 4 pm.",
    },
    {
      id: "RQ-209",
      club: "Debate Union",
      event: "Finals rehearsal",
      owner: "Tara Shah",
      due: "Sat 10 am",
      items: ["Wireless microphone"],
      note: "Rehearsal runs into the evening.",
    },
    {
      id: "RQ-217",
      club: "Photo Circle",
      event: "Street portrait walk",
      owner: "Dev Menon",
      due: "Sat noon",
      items: ["Digital camera"],
      note: "Collection on Saturday morning.",
    },
  ];
  const assets = [
    { id: "PR-04", type: "HDMI projector", model: "BenQ MH550", bin: "A2" },
    {
      id: "PR-06",
      type: "HDMI projector",
      model: "Epson EB-X49",
      bin: "Workshop",
      repair: true,
    },
    { id: "SP-02", type: "Portable speaker", model: "JBL Eon One", bin: "B1" },
    { id: "SP-05", type: "Portable speaker", model: "Bose S1", bin: "B2" },
    {
      id: "AD-12",
      type: "USB-C → HDMI adapter",
      model: "Belkin AVC002",
      bin: "C4",
    },
    {
      id: "AD-15",
      type: "USB-C → HDMI adapter",
      model: "Anker A8312",
      bin: "C4",
    },
    { id: "MI-09", type: "Wireless microphone", model: "Shure BLX", bin: "B3" },
    { id: "CA-03", type: "Digital camera", model: "Sony A6400", bin: "D2" },
  ];
  const people = [
    "Isha Rao",
    "Kabir Sen",
    "Leela Das",
    "Tara Shah",
    "Dev Menon",
  ];
  const shifts = [
    {
      time: "Friday · 3:45 pm",
      at: 945,
      title: "Pickup at the counter",
      text: "Kabir is here for the Film Society screening. The film starts at four. Can he leave with everything he needs?",
      next: "Move to return time",
    },
    {
      time: "Friday · 7:30 pm",
      at: 1170,
      title: "The kit comes back in pieces",
      text: "Kabir has brought back the projector and speaker. “Leela still has the adapter. She’ll drop it off tomorrow at nine.” Take the return and hand over to the morning shift.",
      next: "Move to next morning",
    },
    {
      time: "Saturday · 9:00 am",
      at: 1980,
      title: "Morning shift",
      text: "You’ve just taken over. Leela walks in with an adapter. Work out what was outstanding from the screening and close the loan for the right item.",
    },
  ];
  const pages = [
    ["Requests", "clipboard-list"],
    ["Inventory", "package"],
    ["Loan register", "book-open"],
    ["Desk book", "messages-square"],
  ];
  // Desk book messages, with desk-clock minutes from Friday 00:00 so the handover
  // drafter can read them alongside the slips.
  const messages = [
    {
      phase: 0,
      at: 920,
      time: "Friday · 3:20 pm",
      author: "Isha Rao",
      club: "Film Society",
      text: "Kabir Sen is picking up our whole screening kit. Please issue it in his name. I’m setting up in the courtyard.",
    },
    {
      phase: 0,
      at: 930,
      time: "Friday · 3:30 pm",
      author: "Tara Shah",
      club: "Debate Union",
      text: "Our microphone stays with me overnight. I’ll return it by 10 am Saturday.",
    },
    {
      phase: 1,
      at: 1170,
      time: "Friday · 7:30 pm",
      author: "Kabir Sen",
      club: "Film Society",
      text: "I brought the projector and speaker. Leela Das has our adapter. She’ll be at the counter at 9 am tomorrow.",
    },
  ];
  const original = () => ({
    version: 1,
    tab: "Requests",
    phase: 0,
    selected: "",
    filter: "All items",
    loans: [
      {
        num: 401,
        req: "RQ-209",
        asset: "MI-09",
        who: "Tara Shah",
        due: "Sat 10 am",
        back: false,
      },
    ],
    notes: [],
    handovers: [],
    editing: false,
    onlyOpen: true,
    notice: "Sample shift · All records are fictional.",
  });
  let s = original();
  const getAsset = (id) => assets.find((x) => x.id === id);
  const getReq = (id) => requests.find((x) => x.id === id);
  const out = (id) => s.loans.find((l) => l.asset === id && !l.back);
  const getLoan = (num) => s.loans.find((l) => l.num === Number(num));
  const seenMessages = () => messages.filter((m) => m.phase <= s.phase);
  // The drafter sees only the desk's records: slips, units, requests and messages so far.
  const draftNow = () =>
    CampusHandover.draftHandover({
      now: shifts[s.phase].at,
      handoverTo: (shifts[s.phase + 1] || shifts[s.phase]).at,
      loans: s.loans.map((l) => ({
        ...l,
        backAt: !l.back
          ? undefined
          : shifts[l.backAt]
            ? shifts[l.backAt].at
            : Infinity,
      })),
      assets,
      requests,
      people,
      messages: seenMessages(),
    });
  const flagLabels = {
    "closed-but-out": () => ["Slip closed, item still out", "late"],
    "said-returned": () => ["Said returned, slip open", "late"],
    late: () => ["Overdue", "late"],
    "holder-differs": (it) => ["Now with " + it.holder, "soon"],
    arriving: (it) => ["Back " + it.expected, "soon"],
    "look-alike": (it) => [
      it.bin ? "Look-alike in bin " + it.bin : "Look-alike in the same bin",
      "plain",
    ],
  };
  const chips = (it) =>
    '<div class="chips">' +
    it.flags
      .filter((f) => f !== "arriving") // the next-step line already gives the time
      .map((f) => {
        const [text, tone] = Object.hasOwn(flagLabels, f)
          ? flagLabels[f](it)
          : [f, "plain"];
        return '<span class="tag ' + tone + '">' + esc(text) + "</span>";
      })
      .join("") +
    "</div>";
  const resolved = (it) => {
    if (it.done) return true;
    const l = getLoan(it.slip);
    return !it.flags.includes("closed-but-out") && (!l || l.back);
  };
  const openCount = (h) => h.items.filter((it) => !resolved(it)).length;
  const esc = (x) =>
    String(x).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const opts = (list) =>
    list
      .map(([v, t]) => '<option value="' + esc(v) + '">' + esc(t) + "</option>")
      .join("");
  const btn = (label, act, val = "", style = "") =>
    '<button type="button" data-action="' +
    act +
    '" data-val="' +
    esc(val) +
    '" class="' +
    style +
    '">' +
    esc(label) +
    "</button>";
  const head = (title, sub, control = "") =>
    '<div class="sectionhead"><div><h2>' +
    title +
    "</h2><small>" +
    sub +
    "</small></div>" +
    control +
    "</div>";
  const row = (label, sub, right) =>
    '<div class="row"><div><strong>' +
    esc(label) +
    "</strong><small>" +
    esc(sub) +
    "</small></div><div>" +
    right +
    "</div></div>";
  const badge = (t, good = false) =>
    '<span class="tag' + (good ? " good" : "") + '">' + esc(t) + "</span>";
  function requestPage() {
    let html = head(
      "Approved requests",
      "Student Activities Office · 3 approved forms",
    );
    if (s.selected) {
      const r = getReq(s.selected);
      html +=
        btn("Back to list", "close") +
        '<div class="record"><small>' +
        r.id +
        " · Approved</small><h3>" +
        r.event +
        "</h3><p>" +
        r.club +
        " · Filed by " +
        r.owner +
        "</p><p><b>Return by</b> " +
        r.due +
        "</p><p><b>Approved equipment</b></p><ul>" +
        r.items.map((x) => "<li>" + x + "</li>").join("") +
        "</ul><p>" +
        r.note +
        "</p></div>";
    } else
      html += requests
        .map((r) =>
          row(
            r.event,
            r.id + " · " + r.club,
            btn("View form", "request", r.id),
          ),
        )
        .join("");
    return html;
  }
  function inventory() {
    let html = head(
      "Inventory",
      "Physical units · home shelf and current availability",
    );
    html +=
      '<div class="buttons"><label>Show <select data-filter>' +
      opts(
        ["All items", "On shelf", "On loan", "In repair"].map((f) => [f, f]),
      ) +
      "</select></label></div>";
    for (const a of assets) {
      const status = a.repair
        ? "In repair"
        : out(a.id)
          ? "On loan"
          : "On shelf";
      if (s.filter !== "All items" && s.filter !== status) continue;
      html += row(
        a.id + " · " + a.type,
        a.model + " · " + a.bin,
        badge(status, status === "On shelf"),
      );
    }
    return html;
  }
  function register() {
    let html = head(
      "Loan register",
      "One slip per physical unit",
      s.editing
        ? btn("Cancel", "cancel")
        : btn("New issue slip", "new", "", "primary"),
    );
    if (s.editing) {
      const available = assets.filter((a) => !a.repair && !out(a.id));
      const select = (label, key, options) =>
        "<label><span>" +
        label +
        '</span><select name="' +
        key +
        '" required><option value="">Select…</option>' +
        opts(options) +
        "</select></label>";
      return (
        html +
        '<form data-issue><div class="form">' +
        select(
          "Approved request",
          "req",
          requests.map((r) => [r.id, r.id + " · " + r.club]),
        ) +
        select(
          "Unit leaving the desk",
          "asset",
          available.map((a) => [a.id, a.id + " · " + a.type]),
        ) +
        select(
          "Collected by",
          "who",
          people.map((p) => [p, p]),
        ) +
        select(
          "Return by",
          "due",
          ["Fri 8 pm", "Sat 9 am", "Sat 10 am", "Sat noon"].map((d) => [d, d]),
        ) +
        '</div><button type="submit" class="primary">Save issue slip</button></form>'
      );
    }
    html +=
      handoverHint() +
      '<div class="buttons">' +
      ["Outstanding", "All slips"]
        .map(
          (v, i) =>
            '<button type="button" data-action="scope" data-val="' +
            i +
            '" aria-pressed="' +
            (s.onlyOpen === (i === 0)) +
            '">' +
            v +
            "</button>",
        )
        .join("") +
      "</div>";
    const shown = s.loans
      .filter((l) => !s.onlyOpen || !l.back)
      .slice()
      .reverse();
    if (!shown.length) html += "<p>No outstanding slips.</p>";
    for (const l of shown)
      html += row(
        "L-" + l.num + " · " + l.asset,
        l.req + " · " + l.who + " · Due " + l.due,
        l.back
          ? badge("Returned")
          : btn("Record return", "return", String(l.num)),
      );
    return html;
  }
  function deskbook() {
    let html =
      head("Desk book", "Messages from clubs and handovers between shifts") +
      handoverPanel();
    const entries = seenMessages().map((m) => [
      m.time,
      m.author + " · " + m.club,
      m.text,
    ]);
    for (const n of s.notes)
      entries.push([shifts[n.phase].time, "Counter handover", n.text]);
    for (const [t, author, body] of entries.slice().reverse())
      html +=
        '<article class="record"><small>' +
        esc(t) +
        "</small><h3>" +
        esc(author) +
        "</h3><p>" +
        esc(body) +
        "</p></article>";
    return html;
  }
  // What the handover needs right now: lines still open from the last shift, or a
  // draft this shift has not signed. Drives the register hint and the tab count.
  function handoverNeeds() {
    const h = s.handovers.filter((x) => x.phase < s.phase).pop();
    const open = h ? openCount(h) : 0;
    if (open) return { open, from: shifts[h.phase].time };
    const signed = s.handovers.some((x) => x.phase === s.phase);
    if (s.phase > 0 && shifts[s.phase].next && !signed)
      return { unsigned: draftNow().length };
    return null;
  }
  function handoverHint() {
    const need = handoverNeeds();
    if (!need) return "";
    const plural = (n) => n + (n === 1 ? " item" : " items");
    const text = need.open
      ? "Handover from " + need.from + ": " + plural(need.open) + " still open."
      : "Handover not signed yet: " + plural(need.unsigned) + " drafted from the records.";
    return (
      '<p class="hint">' +
      esc(text) +
      btn("Open handover", "tab", "Desk book") +
      "</p>"
    );
  }
  function deskCount() {
    const need = handoverNeeds();
    const n = need ? need.open || need.unsigned : 0;
    return n
      ? '<span class="count">' + n + '<span class="sr"> handover items</span></span>'
      : "";
  }
  // The next step comes first. The records behind it stay in view while the clerk
  // checks the draft, and fold away once the handover is signed.
  function handoverItem(it, extra, folded) {
    const records =
      '<ul class="evidence">' +
      it.text.map((t) => "<li>" + esc(t) + "</li>").join("") +
      "</ul>";
    return (
      (it.action ? '<p class="action">' + esc(it.action) + "</p>" : "") +
      chips(it) +
      (it.note
        ? '<p class="clerknote"><b>Clerk’s note:</b> ' + esc(it.note) + "</p>"
        : "") +
      (folded
        ? '<details class="why"><summary>Records behind this (' +
          it.text.length +
          ")</summary>" +
          records +
          "</details>"
        : records) +
      extra
    );
  }
  // A signed handover stays live: each line closes itself when its slip closes.
  function handoverCard(h, title) {
    const hi = s.handovers.indexOf(h);
    const open = openCount(h);
    let html =
      '<div class="record handover"><small>' +
      esc(title) +
      "</small><h3>" +
      esc(
        h.items.length
          ? open + " of " + h.items.length + " still open"
          : "Nothing was outstanding",
      ) +
      "</h3>";
    h.items.forEach((it, i) => {
      const l = getLoan(it.slip);
      const done = resolved(it);
      const action = done
        ? badge(it.done ? "Checked" : "Slip closed", true)
        : l && !l.back
          ? btn("Record return of " + l.asset, "return", String(l.num), "primary")
          : btn("Mark checked", "hdone", hi + ":" + i);
      html +=
        '<div class="hitem' +
        (done ? " done" : "") +
        '"><strong>' +
        esc(it.title) +
        "</strong>" +
        handoverItem(it, action, true) +
        "</div>";
    });
    if (h.extra) html += "<p><b>Also:</b> " + esc(h.extra) + "</p>";
    return html + "</div>";
  }
  // The outgoing clerk checks a draft built from the records instead of a blank box.
  function handoverPanel() {
    const received = s.handovers.filter((h) => h.phase < s.phase).pop();
    const html = received
      ? handoverCard(received, "Handover from " + shifts[received.phase].time)
      : "";
    const mine = s.handovers.find((h) => h.phase === s.phase);
    if (mine)
      return (
        html +
        handoverCard(mine, "Your handover · signed off " + shifts[mine.phase].time)
      );
    if (s.phase === 0)
      return (
        html +
        '<p class="hint">At the end of the shift, the handover is drafted here from the records for you to check.</p>'
      );
    const items = draftNow();
    let form =
      '<form data-handover class="record handover"><small>Drafted from the loan register and ' +
      seenMessages().length +
      " desk book messages · tick each line once you have checked it</small><h3>Handover for the next shift</h3>";
    if (!items.length) form += "<p>The records show nothing outstanding.</p>";
    items.forEach((it, i) => {
      form +=
        '<div class="hitem"><label class="hcheck"><input type="checkbox" name="ok' +
        i +
        '" required /><strong>' +
        esc(it.title) +
        "</strong></label>" +
        handoverItem(
          it,
          '<input name="note' +
            i +
            '" maxlength="200" autocomplete="off" placeholder="Add or correct something (optional)" />',
        ) +
        "</div>";
    });
    form +=
      '<label class="full"><span>Anything else the next shift should know?</span><textarea name="extra" rows="2" maxlength="400"></textarea></label><button type="submit" class="primary">Sign off handover</button></form>';
    return (
      html +
      (received
        ? '<details class="later"><summary>Draft your own handover</summary>' +
          form +
          "</details>"
        : form)
    );
  }
  const screens = {
    Requests: requestPage,
    Inventory: inventory,
    "Loan register": register,
    "Desk book": deskbook,
  };
  function paint() {
    const phase = shifts[s.phase];
    q("[data-clock]").textContent = phase.time;
    q("[data-shift-title]").textContent = phase.title;
    q("[data-shift]").textContent = phase.text;
    const advance = q('[data-action="advance"]');
    advance.hidden = !phase.next;
    advance.textContent = phase.next || "";
    q("[data-nav]").innerHTML = pages
      .map(
        ([n, icon]) =>
          '<button type="button" data-action="tab" data-val="' +
          n +
          '" aria-pressed="' +
          (s.tab === n) +
          '"><svg aria-hidden="true" class="store-icon"><use href="#icon-' +
          icon +
          '"></use></svg>' +
          n +
          (n === "Desk book" ? deskCount() : "") +
          "</button>",
      )
      .join("");
    q("[data-page]").innerHTML = screens[s.tab]();
    if (q("[data-filter]")) q("[data-filter]").value = s.filter;
    q("[data-status]").textContent = s.notice;
  }
  function commit(msg) {
    if (msg) s.notice = msg;
    paint();
    try {
      localStorage.setItem(storageKey, JSON.stringify(s));
    } catch {
      q("[data-status]").textContent +=
        " Browser storage is unavailable. Progress lasts for this visit.";
    }
  }
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-action]");
    if (!b) return;
    const v = b.dataset.val;
    switch (b.dataset.action) {
      case "restart":
        s = original();
        break;
      case "advance":
        if (s.phase < 2) s.phase++;
        s.notice = "Shift time updated.";
        break;
      case "tab":
        s.tab = v;
        s.editing = false;
        break;
      case "close":
        s.selected = "";
        break;
      case "request":
        s.selected = v;
        break;
      case "new":
        s.editing = true;
        break;
      case "cancel":
        s.editing = false;
        break;
      case "scope":
        s.onlyOpen = v === "0";
        break;
      case "hdone": {
        const [hi, ii] = String(v).split(":").map(Number);
        const it = s.handovers[hi] && s.handovers[hi].items[ii];
        if (!it) return;
        it.done = true;
        s.notice = "Handover item marked checked.";
        break;
      }
      case "return": {
        const l = s.loans.find((l) => l.num === Number(v));
        if (!l || l.back) return;
        l.back = true;
        l.backAt = s.phase;
        s.notice = l.asset + " returned to stock. Slip L-" + l.num + " closed.";
        break;
      }
    }
    commit();
  });
  root.addEventListener("change", (e) => {
    if (e.target.matches("[data-filter]")) {
      s.filter = e.target.value;
      commit();
    }
  });
  root.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    const form = new FormData(f);
    if (f.matches("[data-handover]")) {
      if (s.handovers.some((h) => h.phase === s.phase)) return;
      const items = draftNow().map((it, i) => ({
        ...it,
        note: String(form.get("note" + i) || "")
          .trim()
          .slice(0, 200),
      }));
      s.handovers.push({
        phase: s.phase,
        items,
        extra: String(form.get("extra") || "")
          .trim()
          .slice(0, 400),
      });
      commit(
        "Handover signed off with " +
          items.length +
          (items.length === 1 ? " item." : " items."),
      );
      return;
    }
    if (!f.matches("[data-issue]")) return;
    const [req, asset, who, due] = ["req", "asset", "who", "due"].map((k) =>
      form.get(k),
    );
    const unit = getAsset(asset),
      r = getReq(req);
    if (!r || !unit || unit.repair || out(asset) || !people.includes(who))
      return;
    if (!r.items.includes(unit.type)) {
      q("[data-status]").textContent =
        "This equipment type is outside the approved request. Choose an approved unit.";
      return;
    }
    if (
      s.loans.some(
        (l) => l.req === req && !l.back && getAsset(l.asset).type === unit.type,
      )
    ) {
      q("[data-status]").textContent =
        "The approved quantity of this equipment type is already on loan.";
      return;
    }
    const num = Math.max(...s.loans.map((l) => l.num)) + 1;
    s.loans.push({ num, req, asset, who, due, back: false });
    s.editing = false;
    commit("Issued " + asset + " to " + who + " on slip L-" + num + ".");
  });
  const validHandover = (h) =>
    h &&
    shifts[h.phase] &&
    typeof (h.extra || "") === "string" &&
    Array.isArray(h.items) &&
    h.items.every(
      (it) =>
        it &&
        typeof it.title === "string" &&
        Array.isArray(it.text) &&
        Array.isArray(it.flags),
    );
  function restore(d) {
    if (
      !d ||
      d.version !== 1 ||
      !Object.hasOwn(screens, d.tab) ||
      !shifts[d.phase] ||
      (d.selected && !getReq(d.selected)) ||
      !Array.isArray(d.notes) ||
      !d.notes.every(
        (n) => n && shifts[n.phase] && typeof n.text === "string",
      ) ||
      !Array.isArray(d.loans) ||
      !d.loans.length ||
      !d.loans.every(
        (l) =>
          l && getReq(l.req) && getAsset(l.asset) && Number.isInteger(l.num),
      )
    )
      return;
    s = {
      ...original(),
      ...d,
      handovers: (Array.isArray(d.handovers)
        ? d.handovers.filter(validHandover)
        : []
      ).map((h) => ({ ...h, items: h.items.map((it) => ({ ...it })) })),
      loans: d.loans.map((l) => ({ ...l })),
      notes: d.notes.map((n) => ({ ...n })),
    };
    paint();
  }
  paint();
  try {
    restore(JSON.parse(localStorage.getItem(storageKey)));
  } catch {
    // Keep the fresh shift when storage is unavailable or the saved data is invalid.
  }
})();
