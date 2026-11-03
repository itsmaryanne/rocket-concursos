(() => {
  const subjects = [
    "Português",
    "Matemática",
    "Raciocínio Lógico",
    "Direito Constitucional",
    "Direito Administrativo",
    "Administração Pública",
    "Informática",
    "Ética e Políticas Públicas",
    "Conhecimentos específicos",
    "Outros",
  ];
  const KEY = "trilha_aprovacao_v2";
  const OLD_KEY = "trilha_aprovacao_v1";
  const MAX_STUDENTS = 5;
  const MAX_NAME = 30;

  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, "0");
  // Data LOCAL (toISOString usa UTC e "pulava" para o dia seguinte à noite no Brasil)
  const iso = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => iso(new Date());
  const uid = () => crypto.randomUUID();

  /* ---------- Modelo de dados ----------
     { version: 2, activeId, students: [{ id, name, records, reviews, mocks, goals }] }
     Só existe o que está em "students": nomes antigos não ficam mais "escondidos". */
  const arr = (x) => (Array.isArray(x) ? x : []);

  function blankStudent(name) {
    return {
      id: uid(),
      name,
      records: [],
      reviews: [],
      mocks: [],
      goals: { questions: 150, sessions: 15 },
    };
  }

  function sanitizeStudent(s, fallbackName) {
    s = s && typeof s === "object" ? s : {};
    const name =
      String(s.name ?? fallbackName ?? "").trim().slice(0, MAX_NAME) ||
      "Estudante";
    return {
      id: typeof s.id === "string" && s.id ? s.id : uid(),
      name,
      records: arr(s.records),
      reviews: arr(s.reviews),
      mocks: arr(s.mocks),
      goals: {
        questions: Math.max(1, +s.goals?.questions || 150),
        sessions: Math.max(1, +s.goals?.sessions || 15),
      },
    };
  }

  const isEmpty = (s) => !s.records.length && !s.reviews.length && !s.mocks.length;

  // Formato antigo: { "Mary": {...}, "Namorado": {...}, "Eu": {...}, "Dupla": {...} }
  // Só migra quem tem dados de verdade (descarta perfis vazios/obsoletos).
  function fromLegacy(old) {
    return Object.entries(old && typeof old === "object" ? old : {})
      .filter(([, v]) => v && typeof v === "object")
      .map(([name, v]) => sanitizeStudent({ ...v, id: undefined }, name))
      .filter((s) => !isEmpty(s));
  }

  function normalize(raw) {
    const seen = new Set();
    let students = arr(raw?.students)
      .map((s) => sanitizeStudent(s))
      .filter((s) => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      })
      .slice(0, MAX_STUDENTS);
    if (!students.length) students = [blankStudent("Estudante 1")];
    const activeId = students.some((s) => s.id === raw?.activeId)
      ? raw.activeId
      : students[0].id;
    return { version: 2, activeId, students };
  }

  function load() {
    try {
      const cur = localStorage.getItem(KEY);
      if (cur) return normalize(JSON.parse(cur));
      const old = localStorage.getItem(OLD_KEY);
      if (old) return normalize({ students: fromLegacy(JSON.parse(old)) });
    } catch (e) { }
    return normalize({});
  }

  let state = load();

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      alert("Não foi possível salvar no navegador (armazenamento cheio ou bloqueado). Exporte um backup.");
    }
    render();
  }
  function user() {
    return state.students.find((s) => s.id === state.activeId);
  }
  const nameTaken = (name, exceptId) =>
    state.students.some(
      (s) => s.id !== exceptId && s.name.toLowerCase() === name.toLowerCase(),
    );

  function esc(s) {
    return String(s ?? "").replace(
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
  }
  function fillSelect(id) {
    $(id).innerHTML = subjects
      .map((s) => `<option>${esc(s)}</option>`)
      .join("");
  }
  ["rSubject", "vSubject"].forEach(fillSelect);
  $("rDate").value = today();
  $("vDate").value = today();
  $("sDate").value = today();

  /* ---------- Estudantes ---------- */
  function renderPeople() {
    const box = $("personSwitch");
    box.innerHTML = "";
    state.students.forEach((s) => {
      const b = document.createElement("button");
      b.textContent = s.name;
      b.classList.toggle("active", s.id === state.activeId);
      b.addEventListener("click", () => {
        state.activeId = s.id;
        save();
      });
      box.appendChild(b);
    });
    if (state.students.length < MAX_STUDENTS) {
      const add = document.createElement("button");
      add.textContent = `+ Adicionar estudante (${state.students.length}/${MAX_STUDENTS})`;
      add.addEventListener("click", () => {
        $("studentForm").classList.remove("hidden");
        $("stName").focus();
      });
      box.appendChild(add);
    } else {
      $("studentForm").classList.add("hidden");
      const full = document.createElement("span");
      full.className = "muted";
      full.style.alignSelf = "center";
      full.textContent = `Limite de ${MAX_STUDENTS} estudantes atingido`;
      box.appendChild(full);
    }
    $("removeBtn").disabled = state.students.length < 2;
  }

  $("studentForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (state.students.length >= MAX_STUDENTS) return;
    const name = $("stName").value.trim().slice(0, MAX_NAME);
    if (!name) return;
    if (nameTaken(name)) return alert("Já existe um estudante com esse nome.");
    const s = blankStudent(name);
    state.students.push(s);
    state.activeId = s.id;
    e.target.reset();
    e.target.classList.add("hidden");
    save();
  });
  $("stCancel").addEventListener("click", () => {
    $("studentForm").reset();
    $("studentForm").classList.add("hidden");
  });
  $("renameBtn").addEventListener("click", () => {
    const u = user();
    const name = (prompt("Novo nome do estudante:", u.name) || "")
      .trim()
      .slice(0, MAX_NAME);
    if (!name || name === u.name) return;
    if (nameTaken(name, u.id)) return alert("Já existe um estudante com esse nome.");
    u.name = name;
    save();
  });
  $("removeBtn").addEventListener("click", () => {
    if (state.students.length < 2) return;
    const u = user();
    if (
      !confirm(
        `Remover "${u.name}" e TODOS os dados dele(a)? Esta ação não pode ser desfeita. Exporte um backup antes, se necessário.`,
      )
    )
      return;
    state.students = state.students.filter((s) => s.id !== u.id);
    state.activeId = state.students[0].id;
    save();
  });

  document.querySelectorAll("[data-tab]").forEach((b) =>
    b.addEventListener("click", () => {
      document
        .querySelectorAll("[data-tab]")
        .forEach((x) => x.classList.toggle("active", x === b));
      document
        .querySelectorAll(".panel")
        .forEach((x) => x.classList.toggle("hidden", x.id !== b.dataset.tab));
      render();
    }),
  );

  /* ---------- Formulários ---------- */
  $("recordForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const total = +$("rTotal").value,
      correct = +$("rCorrect").value;
    if (total < 1 || correct < 0 || correct > total)
      return alert("Confira a quantidade de questões e acertos.");
    user().records.push({
      id: uid(),
      date: $("rDate").value,
      subject: $("rSubject").value,
      topic: $("rTopic").value.trim(),
      source: $("rSource").value.trim(),
      total,
      correct,
      difficulty: $("rDifficulty").value,
      error: $("rError").value,
      notes: $("rNotes").value.trim(),
    });
    e.target.reset();
    $("rDate").value = today();
    $("rTotal").value = 20;
    $("rCorrect").value = 14;
    save();
    alert("Registro salvo!");
  });
  $("reviewForm").addEventListener("submit", (e) => {
    e.preventDefault();
    user().reviews.push({
      id: uid(),
      subject: $("vSubject").value,
      topic: $("vTopic").value.trim(),
      date: $("vDate").value,
      type: $("vType").value,
      done: false,
    });
    e.target.reset();
    $("vDate").value = today();
    save();
  });
  $("mockForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const total = +$("sTotal").value,
      correct = +$("sCorrect").value;
    if (total < 1 || correct < 0 || correct > total)
      return alert("Confira a quantidade de questões e acertos.");
    user().mocks.push({
      id: uid(),
      date: $("sDate").value,
      name: $("sName").value.trim(),
      total,
      correct,
      minutes: +$("sMinutes").value || 0,
      notes: $("sNotes").value.trim(),
    });
    e.target.reset();
    $("sDate").value = today();
    $("sTotal").value = 60;
    $("sCorrect").value = 35;
    save();
    alert("Simulado salvo!");
  });
  $("goalForm").addEventListener("submit", (e) => {
    e.preventDefault();
    user().goals = {
      questions: Math.max(1, +$("gQuestions").value),
      sessions: Math.max(1, +$("gSessions").value),
    };
    save();
    alert("Metas atualizadas!");
  });

  /* ---------- Cálculos e renderização ---------- */
  function weekStart(d) {
    let x = new Date(d + "T12:00:00");
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return iso(x);
  }
  function pct(a, b) {
    return b ? Math.round((a / b) * 100) : 0;
  }
  function render() {
    renderPeople();
    const u = user(),
      rs = u.records,
      questions = rs.reduce((a, r) => a + r.total, 0),
      correct = rs.reduce((a, r) => a + r.correct, 0),
      pending = u.reviews.filter((r) => !r.done).length;
    $("mQuestions").textContent = questions.toLocaleString("pt-BR");
    $("mAccuracy").textContent = questions
      ? pct(correct, questions) + "%"
      : "—";
    $("mSessions").textContent = rs.length;
    $("mReviews").textContent = pending;
    $("gQuestions").value = u.goals.questions;
    $("gSessions").value = u.goals.sessions;
    renderTrend(rs);
    renderSubjects(rs);
    renderRecent(rs);
    renderReviews(u);
    renderErrors(rs);
    renderWeak(rs);
    renderMocks(u);
    renderGoals(u);
  }
  function renderTrend(rs) {
    const c = $("trend"),
      ctx = c.getContext("2d"),
      w = c.clientWidth || 500,
      h = 210,
      dpr = window.devicePixelRatio || 1;
    c.width = w * dpr;
    c.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    const days = [];
    for (let i = 6; i >= 0; i--) {
      let d = new Date();
      d.setDate(d.getDate() - i);
      days.push(iso(d));
    }
    const vals = days.map((d) =>
      rs.filter((r) => r.date === d).reduce((a, r) => a + r.correct, 0),
    );
    const max = Math.max(5, ...vals),
      left = 30,
      bottom = 175,
      top = 15,
      usable = w - left - 12;
    ctx.font = "11px system-ui";
    ctx.fillStyle = getComputedStyle(document.body).color;
    ctx.strokeStyle = "rgba(130,145,135,.25)";
    for (let i = 0; i < 4; i++) {
      let y = top + ((bottom - top) * i) / 3;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(w - 8, y);
      ctx.stroke();
    }
    ctx.fillStyle = getComputedStyle(document.body).color;
    days.forEach((d, i) => {
      let x = left + (usable * (i + 0.5)) / 7,
        y = bottom - (vals[i] / max) * (bottom - top);
      ctx.fillText(d.slice(8, 10) + "/" + d.slice(5, 7), x - 15, 198);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--chart").trim() || "#7e81bd";
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = getComputedStyle(document.body).color;
      if (vals[i]) ctx.fillText(vals[i], x - 4, y - 10);
    });
  }
  function renderSubjects(rs) {
    const box = $("subjectBars");
    if (!rs.length) {
      box.innerHTML =
        '<div class="empty">Registre questões para visualizar seu desempenho por matéria.</div>';
      return;
    }
    const groups = {};
    rs.forEach((r) => {
      groups[r.subject] ??= { c: 0, t: 0 };
      groups[r.subject].c += r.correct;
      groups[r.subject].t += r.total;
    });
    box.innerHTML = Object.entries(groups)
      .sort((a, b) => a[1].c / a[1].t - b[1].c / b[1].t)
      .map(
        ([s, v]) =>
          `<div style="margin:0 0 13px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px"><strong>${esc(s)}</strong><span>${pct(v.c, v.t)}% · ${v.t} questões</span></div><div class="progress"><i style="width:${pct(v.c, v.t)}%"></i></div></div>`,
      )
      .join("");
  }
  function renderRecent(rs) {
    const list = [...rs]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 6);
    $("recent").innerHTML = list.length
      ? `<div class="table-wrap"><table><thead><tr><th>Data</th><th>Disciplina / assunto</th><th>Resultado</th><th>Dificuldade</th></tr></thead><tbody>${list.map((r) => `<tr><td>${esc(r.date)}</td><td><b>${esc(r.subject)}</b><br>${esc(r.topic)}</td><td>${r.correct}/${r.total} (${pct(r.correct, r.total)}%)</td><td>${esc(r.error || "—")}</td></tr>`).join("")}</tbody></table></div>`
      : '<div class="empty">Ainda não há registros. Comece pela aba “Registrar questões”.</div>';
  }
  function renderReviews(u) {
    const list = [...u.reviews].sort((a, b) => a.date.localeCompare(b.date));
    $("reviewList").innerHTML = list.length
      ? list
        .map(
          (r) =>
            `<div style="display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--line);opacity:${r.done ? 0.55 : 1}"><input type="checkbox" style="width:auto;margin-top:4px" ${r.done ? "checked" : ""} onchange="window.toggleReview('${esc(r.id)}',this.checked)"><div style="flex:1"><b>${esc(r.topic)}</b><div class="muted">${esc(r.subject)} · ${esc(r.type)} · ${esc(r.date)}</div></div><button class="small danger" onclick="window.removeReview('${esc(r.id)}')">Excluir</button></div>`,
        )
        .join("")
      : '<div class="empty">Nenhuma revisão agendada.</div>';
  }
  window.toggleReview = (id, v) => {
    const r = user().reviews.find((x) => x.id === id);
    if (r) r.done = v;
    save();
  };
  window.removeReview = (id) => {
    user().reviews = user().reviews.filter((x) => x.id !== id);
    save();
  };
  function renderErrors(rs) {
    const g = {};
    rs.forEach((r) => {
      if (r.error) g[r.error] = (g[r.error] || 0) + 1;
    });
    const list = Object.entries(g).sort((a, b) => b[1] - a[1]);
    $("errorList").innerHTML = list.length
      ? list
        .map(
          ([k, v]) =>
            `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line);font-size:13px"><span>${esc(k)}</span><b>${v} ocorrência(s)</b></div>`,
        )
        .join("")
      : '<div class="empty">As dificuldades registradas aparecerão aqui.</div>';
  }
  function renderWeak(rs) {
    const g = {};
    rs.forEach((r) => {
      const k = r.subject + " — " + r.topic;
      g[k] ??= { c: 0, t: 0, n: 0 };
      g[k].c += r.correct;
      g[k].t += r.total;
      g[k].n++;
    });
    const list = Object.entries(g)
      .filter((x) => x[1].t >= 5)
      .sort((a, b) => a[1].c / a[1].t - b[1].c / b[1].t)
      .slice(0, 8);
    $("weakList").innerHTML = list.length
      ? list
        .map(
          ([k, v]) =>
            `<div style="padding:10px 0;border-bottom:1px solid var(--line)"><div style="display:flex;justify-content:space-between;gap:8px;font-size:13px"><b>${esc(k)}</b><span>${pct(v.c, v.t)}%</span></div><div class="progress" style="margin-top:7px"><i style="width:${pct(v.c, v.t)}%"></i></div><div class="muted">${v.t} questões em ${v.n} registro(s)</div></div>`,
        )
        .join("")
      : '<div class="empty">Registre pelo menos 5 questões por assunto para encontrar pontos de atenção.</div>';
  }
  function renderMocks(u) {
    const a = [...u.mocks].sort((x, y) => y.date.localeCompare(x.date));
    $("mockList").innerHTML = a.length
      ? `<div class="table-wrap"><table><thead><tr><th>Data</th><th>Simulado</th><th>Resultado</th><th>Tempo</th><th></th></tr></thead><tbody>${a.map((m) => `<tr><td>${esc(m.date)}</td><td><b>${esc(m.name)}</b><br><span class="muted">${esc(m.notes)}</span></td><td><b>${pct(m.correct, m.total)}%</b><br>${m.correct}/${m.total}</td><td>${m.minutes ? m.minutes + " min" : "—"}</td><td><button class="small danger" onclick="window.removeMock('${esc(m.id)}')">Excluir</button></td></tr>`).join("")}</tbody></table></div>`
      : '<div class="empty">Seus simulados aparecerão aqui.</div>';
  }
  window.removeMock = (id) => {
    user().mocks = user().mocks.filter((x) => x.id !== id);
    save();
  };
  function renderGoals(u) {
    const start = weekStart(today()),
      week = u.records.filter((r) => r.date >= start && r.date <= today()),
      q = week.reduce((a, r) => a + r.total, 0),
      s = week.length,
      g = u.goals;
    $("goalProgress").innerHTML =
      `<div style="margin-bottom:20px"><div style="display:flex;justify-content:space-between;margin-bottom:7px"><b>Questões</b><span>${q} / ${g.questions}</span></div><div class="progress"><i style="width:${Math.min(100, pct(q, g.questions))}%"></i></div><div class="muted" style="margin-top:5px">${Math.max(0, g.questions - q)} questões para atingir a meta</div></div><div><div style="display:flex;justify-content:space-between;margin-bottom:7px"><b>Sessões</b><span>${s} / ${g.sessions}</span></div><div class="progress"><i style="width:${Math.min(100, pct(s, g.sessions))}%"></i></div><div class="muted" style="margin-top:5px">${Math.max(0, g.sessions - s)} sessões para atingir a meta</div></div>`;
  }

  /* ---------- Backup ---------- */
  $("exportBtn").addEventListener("click", () => {
    // Exporta exatamente o estado atual (só os estudantes que existem agora)
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    }),
      a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `backup-trilha-aprovacao-${today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      let next;
      if (d && Array.isArray(d.students)) {
        next = normalize(d); // formato novo (v2)
      } else if (
        d &&
        typeof d === "object" &&
        Object.values(d).some((v) => v && Array.isArray(v.records))
      ) {
        next = normalize({ students: fromLegacy(d) }); // formato antigo (v1)
      } else {
        throw Error();
      }
      if (
        !confirm(
          "Importar este backup substitui TODOS os dados atuais deste navegador. Continuar?",
        )
      ) {
        e.target.value = "";
        return;
      }
      state = next;
      save();
      alert("Backup importado!");
    } catch (err) {
      alert("Arquivo inválido ou incompatível.");
    }
    e.target.value = "";
  });
  $("clearBtn").addEventListener("click", () => {
    const u = user();
    if (
      confirm(
        `Apagar todos os registros de "${u.name}" deste navegador? Esta ação não pode ser desfeita. Exporte um backup antes, se necessário.`,
      )
    ) {
      Object.assign(u, blankStudent(u.name), { id: u.id });
      save();
    }
  });
  const themeBtn = $("themeBtn");
  function currentTheme() {
    return document.documentElement.dataset.theme || "dark";
  }
  function paintThemeBtn() {
    themeBtn.textContent = currentTheme() === "dark" ? "☀ Modo dia" : "☾ Modo noite";
  }
  themeBtn.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("trilha_tema", next); } catch (e) { }
    paintThemeBtn();
    renderTrend(user().records);
  });
  paintThemeBtn();
  window.addEventListener("resize", () => renderTrend(user().records));
  render();
})();