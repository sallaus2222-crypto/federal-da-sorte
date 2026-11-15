
const DATA_URL = "./data/federal.json";
const DB_NAME = "FederalIntelligence";
const STORE_NAME = "cache";
const ANALYSIS_WINDOW = 15;

let contests = [];
let updatedAt = null;

const $ = (id) => document.getElementById(id);

const fmtDate = (value) => {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
};

const fmtDateTime = (value) =>
  value ? new Date(value).toLocaleString("pt-BR") : "—";

function openDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) return resolve(null);

    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveCache(payload) {
  const db = await openDb();
  if (!db) return;

  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(payload, "latest");
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });

  db.close();
}

async function readCache() {
  const db = await openDb();
  if (!db) return null;

  const value = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get("latest");

    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });

  db.close();
  return value;
}

function setConnection(label, ok = false) {
  $("connectionLabel").textContent = label;
  $("liveDot").style.background = ok ? "var(--green)" : "#d5a64d";
}

function ranked(values) {
  const counts = new Map();

  values.forEach(v => {
    counts.set(v, (counts.get(v) || 0) + 1);
  });

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .filter(x => x.count > 1)
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, 8);
}

function renderRank(id, values) {
  const el = $(id);
  const rows = ranked(values);

  if (!rows.length) {
    el.className = "rank-list empty";
    el.textContent = "Nenhuma repetição nesta janela.";
    return;
  }

  const max = Math.max(...rows.map(x => x.count));

  el.className = "rank-list";

  el.innerHTML = rows.map(x =>
    `<div class="rank-row">
      <span class="rank-value">${x.value}</span>
      <div class="bar">
        <i style="width:${Math.max(5, x.count / max * 100)}%"></i>
      </div>
      <span class="rank-count">${x.count}×</span>
    </div>`
  ).join("");
}

/* =========================================
   TOP PICKS - GERADOR DE SUGESTÕES
========================================= */

function installTopPicksStyles() {
  if ($("topPicksStyles")) return;

  const style = document.createElement("style");
  style.id = "topPicksStyles";

  style.textContent = `
    #topPicksSection {
      margin: 24px 0;
      padding: 20px;
      border: 1px solid rgba(110, 150, 255, .20);
      border-radius: 18px;
      background: linear-gradient(145deg, #151d30, #101725);
      color: #f2f5ff;
    }

    #topPicksSection .tp-heading {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }

    #topPicksSection .tp-eyebrow {
      color: #8daaff;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1.5px;
      margin: 0 0 5px;
    }

    #topPicksSection h2 {
      font-size: 21px;
      margin: 0;
      color: #fff;
    }

    #topPicksSection .tp-description {
      color: #aab5ca;
      font-size: 12px;
      line-height: 1.6;
      margin: 10px 0 18px;
    }

    #topPicksSection .tp-list {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 11px;
    }

    #topPicksSection .tp-card {
      padding: 15px;
      border: 1px solid rgba(255,255,255,.09);
      border-radius: 13px;
      background: rgba(255,255,255,.035);
    }

    #topPicksSection .tp-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    #topPicksSection .tp-position {
      font-size: 11px;
      font-weight: 800;
      color: #91aaff;
    }

    #topPicksSection .tp-score {
      font-size: 10px;
      color: #a9c7ff;
      background: rgba(91,135,255,.13);
      border: 1px solid rgba(91,135,255,.22);
      padding: 4px 8px;
      border-radius: 20px;
    }

    #topPicksSection .tp-number {
      font-size: clamp(27px, 5vw, 35px);
      font-weight: 850;
      letter-spacing: 3px;
      margin: 13px 0 9px;
      color: #fff;
      font-variant-numeric: tabular-nums;
    }

    #topPicksSection .tp-label {
      color: #b5c5e3;
      font-size: 11px;
    }

    #topPicksSection .tp-bar {
      height: 4px;
      background: rgba(255,255,255,.09);
      border-radius: 5px;
      overflow: hidden;
      margin-top: 11px;
    }

    #topPicksSection .tp-bar i {
      display: block;
      height: 100%;
      background: linear-gradient(90deg, #5579ff, #55d6c2);
      border-radius: 5px;
    }

    #topPicksSection .tp-footer {
      border-top: 1px solid rgba(255,255,255,.09);
      margin-top: 17px;
      padding-top: 12px;
      font-size: 10px;
      line-height: 1.6;
      color: #9baac2;
    }

    #topPicksSection .tp-empty {
      color: #aab5ca;
      font-size: 13px;
      padding: 15px 0;
    }
  `;

  document.head.appendChild(style);
}

function ensureTopPicksUI() {
  if ($("topPicksSection")) return;

  installTopPicksStyles();

  const section = document.createElement("section");
  section.id = "topPicksSection";

  section.innerHTML = `
    <div class="tp-heading">
      <div>
        <p class="tp-eyebrow">FEDERAL INTELLIGENCE</p>
        <h2>★ TOP PICKS</h2>
      </div>
      <span class="tp-score">5 SUGESTÕES</span>
    </div>

    <p class="tp-description">
      Combinações selecionadas por análise estatística
      dos últimos concursos disponíveis.
    </p>

    <div id="topPicksList" class="tp-list">
      <div class="tp-empty">Aguardando resultados para análise...</div>
    </div>

    <div class="tp-footer">
      Pontuação estatística relativa, não representa
      probabilidade de premiação. Sorteios são aleatórios.
    </div>
  `;

  const resultsTable = $("resultsBody")?.closest("table");

  if (resultsTable) {
    resultsTable.parentNode.insertBefore(section, resultsTable);
  } else {
    document.body.appendChild(section);
  }
}

function hashSeed(text) {
  let hash = 2166136261;

  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createRandom(seed) {
  let state = seed || 1;

  return function () {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;

    return (state >>> 0) / 4294967296;
  };
}

function buildStatistics(windowed) {
  const positionCounts = Array.from(
    { length: 5 },
    () => Array(10).fill(0)
  );

  const suffixCounts = {
    2: new Map(),
    3: new Map(),
    4: new Map()
  };

  let totalWeight = 0;
  const observedNumbers = [];

  windowed.forEach((contest, index) => {
    const weight = 1 / (1 + index * 0.06);

    contest.premios.forEach(prize => {
      const number = String(prize.bilhete).slice(-5).padStart(5, "0");

      if (!/^\d{5}$/.test(number)) return;

      observedNumbers.push(number);
      totalWeight += weight;

      for (let i = 0; i < 5; i++) {
        positionCounts[i][Number(number[i])] += weight;
      }

      for (const size of [2, 3, 4]) {
        const suffix = number.slice(-size);
        const map = suffixCounts[size];

        map.set(suffix, (map.get(suffix) || 0) + weight);
      }
    });
  });

  return {
    positionCounts,
    suffixCounts,
    totalWeight,
    observedNumbers
  };
}

function scoreNumber(number, stats) {
  let positionScore = 0;

  for (let i = 0; i < 5; i++) {
    const count = stats.positionCounts[i][Number(number[i])];

    const probability =
      (count + 0.5) / (stats.totalWeight + 5);

    positionScore += Math.log(probability);
  }

  const suffixScore = (size, factor) => {
    const suffix = number.slice(-size);
    const count = stats.suffixCounts[size].get(suffix) || 0;

    return Math.log(
      (count + 0.35) / (stats.totalWeight + 0.35)
    ) * factor;
  };

  const ending2 = suffixScore(2, 1.3);
  const ending3 = suffixScore(3, 1.0);
  const ending4 = suffixScore(4, 0.5);

  return {
    total:
      positionScore * 0.7 +
      ending2 +
      ending3 +
      ending4,

    positionScore,
    ending2,
    ending3,
    ending4,

    count2: stats.suffixCounts[2].get(number.slice(-2)) || 0,
    count3: stats.suffixCounts[3].get(number.slice(-3)) || 0,
    count4: stats.suffixCounts[4].get(number.slice(-4)) || 0
  };
}

function digitDistance(a, b) {
  let different = 0;

  for (let i = 0; i < 5; i++) {
    if (a[i] !== b[i]) different++;
  }

  return different;
}

function generateTopPicks(windowed) {
  const stats = buildStatistics(windowed);

  if (!stats.observedNumbers.length) return [];

  const seedText = windowed
    .map(c => `${c.numero}:${c.premios.map(p => p.bilhete).join(",")}`)
    .join("|");

  const random = createRandom(hashSeed(seedText));

  const candidates = new Set(stats.observedNumbers);

  // Cria variações dos números observados.
  stats.observedNumbers.forEach(number => {
    for (let i = 0; i < 5; i++) {
      for (let digit = 0; digit <= 9; digit++) {
        const variant =
          number.slice(0, i) +
          digit +
          number.slice(i + 1);

        candidates.add(variant);
      }
    }
  });

  // Acrescenta combinações para ampliar a análise.
  for (let i = 0; i < 12000; i++) {
    let number = "";

    for (let j = 0; j < 5; j++) {
      number += Math.floor(random() * 10);
    }

    candidates.add(number);
  }

  const evaluated = [...candidates].map(number => ({
    number,
    ...scoreNumber(number, stats)
  }));

  evaluated.sort((a, b) => b.total - a.total);

  const selected = [];

  // Prioriza diversidade entre os cinco números.
  for (const candidate of evaluated) {
    if (selected.length >= 5) break;

    const diverse = selected.every(existing =>
      digitDistance(candidate.number, existing.number) >= 2 &&
      candidate.number.slice(-2) !== existing.number.slice(-2)
    );

    if (diverse) selected.push(candidate);
  }

  // Completa a lista caso os critérios de diversidade sejam restritivos.
  for (const candidate of evaluated) {
    if (selected.length >= 5) break;

    if (!selected.some(item => item.number === candidate.number)) {
      selected.push(candidate);
    }
  }

  const scores = selected.map(item => item.total);
  const max = Math.max(...scores);
  const min = Math.min(...scores);

  return selected.map((item, index) => {
    let label = "Perfil por posição";

    if (item.count2 > 0) label = "Terminação recorrente";
    if (item.count3 > 0) label = "Centena recorrente";
    if (item.count4 > 0) label = "Milhar recorrente";

    const relativeScore = max === min
      ? 100
      : Math.round(70 + ((item.total - min) / (max - min)) * 30);

    return {
      ...item,
      position: index + 1,
      label,
      relativeScore
    };
  });
}

function renderTopPicks(windowed) {
  ensureTopPicksUI();

  const container = $("topPicksList");
  const picks = generateTopPicks(windowed);

  if (!picks.length) {
    container.innerHTML =
      `<div class="tp-empty">Aguardando concursos válidos para gerar sugestões.</div>`;
    return;
  }

  container.innerHTML = picks.map(pick => `
    <article class="tp-card">
      <div class="tp-card-top">
        <span class="tp-position">TOP ${String(pick.position).padStart(2, "0")}</span>
        <span class="tp-score">${pick.relativeScore}/100</span>
      </div>

      <div class="tp-number">${pick.number}</div>

      <div class="tp-label">${pick.label}</div>

      <div class="tp-bar">
        <i style="width:${pick.relativeScore}%"></i>
      </div>
    </article>
  `).join("");
}

/* =========================================
   RENDERIZAÇÃO PRINCIPAL
========================================= */

function render() {
  const windowed = contests.slice(0, ANALYSIS_WINDOW);

  const tickets = windowed.flatMap(c =>
    c.premios.map(p => p.bilhete)
  );

  $("windowCount").textContent =
    `${windowed.length}/${ANALYSIS_WINDOW}`;

  $("ticketCount").textContent = tickets.length;

  const last = windowed[0];

  $("lastContest").textContent =
    last ? `#${last.numero}` : "—";

  $("lastDate").textContent =
    last ? fmtDate(last.data_concurso) : "Aguardando dados";

  $("lastSync").textContent = fmtDateTime(updatedAt);

  $("syncStatus").textContent =
    contests.length ? `${contests.length} concursos no arquivo` : "Sem concursos";

  renderRank("terminacoes", tickets.map(n => n.slice(-2)));
  renderRank("centenas", tickets.map(n => n.slice(-3)));
  renderRank("milhares", tickets.map(n => n.slice(-4)));

  renderTopPicks(windowed);

  $("resultsBody").innerHTML = windowed.length
    ? windowed.map(c => {
        const prizes = [...c.premios].sort(
          (a, b) => a.posicao - b.posicao
        );

        return `
          <tr>
            <td>#${c.numero}</td>
            <td>${fmtDate(c.data_concurso)}</td>
            ${[0, 1, 2, 3, 4].map(i =>
              `<td class="ticket">${prizes[i]?.bilhete || "—"}</td>`
            ).join("")}
          </tr>
        `;
      }).join("")
    : `
      <tr>
        <td colspan="7" class="empty-cell">
          Nenhum resultado disponível. Conecte-se à internet e tente atualizar.
        </td>
      </tr>
    `;
}

function validatePayload(payload) {
  if (!payload || !Array.isArray(payload.concursos)) {
    throw new Error("Arquivo de resultados inválido.");
  }

  const valid = payload.concursos.filter(c =>
    Number.isInteger(Number(c.numero)) &&
    /^\d{4}-\d{2}-\d{2}$/.test(c.data_concurso || "") &&
    Array.isArray(c.premios) &&
    c.premios.length === 5 &&
    c.premios.every(p => /^\d{5,6}$/.test(String(p.bilhete)))
  );

  if (!valid.length) {
    throw new Error("Nenhum concurso passou pela validação.");
  }

  return valid.sort(
    (a, b) => Number(b.numero) - Number(a.numero)
  );
}

async function loadData() {
  setConnection("Consultando dados publicados...");
  $("refreshBtn").disabled = true;

  try {
    const response = await fetch(
      `${DATA_URL}?v=${Date.now()}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(
        `Arquivo de dados indisponível (${response.status}).`
      );
    }

    const payload = await response.json();

    updatedAt = payload.atualizado_em || null;
    contests = validatePayload(payload);

    await saveCache(payload);

    setConnection("Dados atualizados", true);
    render();

  } catch (error) {
    try {
      const cached = await readCache();

      if (cached) {
        updatedAt = cached.atualizado_em || null;
        contests = validatePayload(cached);

        setConnection("Offline · usando cópia local");
        render();

      } else {
        setConnection("Não foi possível carregar os dados");

        $("resultsBody").innerHTML = `
          <tr>
            <td colspan="7" class="empty-cell">
              ${escapeHtml(error.message)}
            </td>
          </tr>
        `;
      }

    } catch (cacheError) {
      setConnection("Falha ao ler dados locais");

      $("resultsBody").innerHTML = `
        <tr>
          <td colspan="7" class="empty-cell">
            ${escapeHtml(cacheError.message)}
          </td>
        </tr>
      `;
    }

  } finally {
    $("refreshBtn").disabled = false;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

$("refreshBtn").addEventListener("click", loadData);

loadData();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .catch(() => {});
  });
}