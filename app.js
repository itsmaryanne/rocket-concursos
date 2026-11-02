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
  const KEY = "trilha_aprovacao_v1";
  let data = load();
  let person = "Eu";
  const $ = (id) => document.getElementById(id);
  const today = () => new Date().toISOString().slice(0, 10);
  function blank() {
    return {
      records: [],
      reviews: [],
      mocks: [],
      goals: { questions: 150, sessions: 15 },
    };
  }
  function load() {
    try {
      return (
        JSON.parse(localStorage.getItem(KEY)) || {
          Eu: blank(),
          Dupla: blank(),
        }
      );
    } catch (e) {
      return { Eu: blank(), Dupla: blank() };
    }
  }
  function save() {
    localStorage.setItem(KEY, JSON.stringify(data));
    render();
  }
  function user() {
    if (!data[person]) data[person] = blank();
    return data[person];
  }
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
  document.querySelectorAll("[data-person]").forEach((b) =>
    b.addEventListener("click", () => {
      person = b.dataset.person;
      document
        .querySelectorAll("[data-person]")
        .forEach((x) => x.classList.toggle("active", x === b));
      render();
    }),
  );
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
  $("recordForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const total = +$("rTotal").value,
      correct = +$("rCorrect").value;
    if (total < 1 || correct < 0 || correct > total)
      return alert("Confira a quantidade de questões e acertos.");
    user().records.push({
      id: crypto.randomUUID(),
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
      id: crypto.randomUUID(),
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
      id: crypto.randomUUID(),
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
  function weekStart(d) {
    let x = new Date(d + "T12:00:00");
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x.toISOString().slice(0, 10);
  }
  function pct(a, b) {
    return b ? Math.round((a / b) * 100) : 0;
  }
  function render() {
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
      days.push(d.toISOString().slice(0, 10));
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
      ctx.fillStyle = "#4d8875";
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
              `<div style="display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid light-dark(#e7ece8,#35433c);opacity:${r.done ? 0.55 : 1}"><input type="checkbox" style="width:auto;margin-top:4px" ${r.done ? "checked" : ""} onchange="window.toggleReview('${r.id}',this.checked)"><div style="flex:1"><b>${esc(r.topic)}</b><div class="muted">${esc(r.subject)} · ${esc(r.type)} · ${esc(r.date)}</div></div><button class="small danger" onclick="window.removeReview('${r.id}')">Excluir</button></div>`,
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
    const arr = Object.entries(g).sort((a, b) => b[1] - a[1]);
    $("errorList").innerHTML = arr.length
      ? arr
          .map(
            ([k, v]) =>
              `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid light-dark(#e7ece8,#35433c);font-size:13px"><span>${esc(k)}</span><b>${v} ocorrência(s)</b></div>`,
          )
          .join("")
      : '<div class="empty">As dificuldades registradas aparecerão aqui.</div>';
  }
  function renderWeak(rs) {
    const g = {};
    rs.forEach((r) => {
      g[r.subject + " — " + r.topic] ??= { c: 0, t: 0, n: 0 };
      g[r.subject + " — " + r.topic].c += r.correct;
      g[r.subject + " — " + r.topic].t += r.total;
      g[r.subject + " — " + r.topic].n++;
    });
    const arr = Object.entries(g)
      .filter((x) => x[1].t >= 5)
      .sort((a, b) => a[1].c / a[1].t - b[1].c / b[1].t)
      .slice(0, 8);
    $("weakList").innerHTML = arr.length
      ? arr
          .map(
            ([k, v]) =>
              `<div style="padding:10px 0;border-bottom:1px solid light-dark(#e7ece8,#35433c)"><div style="display:flex;justify-content:space-between;gap:8px;font-size:13px"><b>${esc(k)}</b><span>${pct(v.c, v.t)}%</span></div><div class="progress" style="margin-top:7px"><i style="width:${pct(v.c, v.t)}%"></i></div><div class="muted">${v.t} questões em ${v.n} registro(s)</div></div>`,
          )
          .join("")
      : '<div class="empty">Registre pelo menos 5 questões por assunto para encontrar pontos de atenção.</div>';
  }
  function renderMocks(u) {
    const a = [...u.mocks].sort((x, y) => y.date.localeCompare(x.date));
    $("mockList").innerHTML = a.length
      ? `<div class="table-wrap"><table><thead><tr><th>Data</th><th>Simulado</th><th>Resultado</th><th>Tempo</th><th></th></tr></thead><tbody>${a.map((m) => `<tr><td>${esc(m.date)}</td><td><b>${esc(m.name)}</b><br><span class="muted">${esc(m.notes)}</span></td><td><b>${pct(m.correct, m.total)}%</b><br>${m.correct}/${m.total}</td><td>${m.minutes ? m.minutes + " min" : "—"}</td><td><button class="small danger" onclick="window.removeMock('${m.id}')">Excluir</button></td></tr>`).join("")}</tbody></table></div>`
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
  $("exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      }),
      a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "backup-trilha-aprovacao.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!d.Eu || !d.Dupla) throw Error();
      data = d;
      save();
      alert("Backup importado!");
    } catch (err) {
      alert("Arquivo inválido ou incompatível.");
    }
    e.target.value = "";
  });
  $("clearBtn").addEventListener("click", () => {
    if (
      confirm(
        "Apagar todos os registros de " +
          person +
          " deste navegador? Esta ação não pode ser desfeita. Exporte um backup antes, se necessário.",
      )
    ) {
      data[person] = blank();
      save();
    }
  });
  window.addEventListener("resize", () => renderTrend(user().records));
  render();
})();
