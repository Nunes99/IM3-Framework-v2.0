if (window.Chart) {
  Chart.defaults.font.family = "'PT Sans', Arial, sans-serif";
  Chart.defaults.color = "#193A64";
  Chart.defaults.plugins.tooltip.enabled = true;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
}

const IM3_API_URL = "https://script.google.com/macros/s/AKfycbzHGdbXxsQLrTjxxyXAvmKX_Ft9UmzaukNkFRQoBm094THUHEEw8sy-RKxIU5VUX9bg/exec";

const ICONS8 = {
  projects: "https://img.icons8.com/fluency-systems-regular/48/project.png",
  assumptions: "https://img.icons8.com/fluency-systems-regular/48/settings.png",
  production: "https://img.icons8.com/fluency-systems-regular/48/factory.png",
  prices: "https://img.icons8.com/fluency-systems-regular/48/price-tag-usd.png",
  capex_opex: "https://img.icons8.com/fluency-systems-regular/48/accounting.png",
  dcf: "https://img.icons8.com/fluency-systems-regular/48/combo-chart.png",
  dcf_results: "https://img.icons8.com/fluency-systems-regular/48/results.png",
  risk_scenarios: "https://img.icons8.com/fluency-systems-regular/48/risk.png",
  map_dnpv: "https://img.icons8.com/fluency-systems-regular/48/flow-chart.png",
  rov: "https://img.icons8.com/fluency-systems-regular/48/decision.png",
  mcda_criteria: "https://img.icons8.com/fluency-systems-regular/48/checklist.png",
  mcda_scores: "https://img.icons8.com/fluency-systems-regular/48/rating.png",
  system_dynamics: "https://img.icons8.com/fluency-systems-regular/48/process.png",
  sd_parameters: "https://img.icons8.com/fluency-systems-regular/48/sliders.png",
  sensitivity: "https://img.icons8.com/fluency-systems-regular/48/tune.png",
  monte_carlo: "https://img.icons8.com/fluency-systems-regular/48/dice.png",
  dashboard_data: "https://img.icons8.com/fluency-systems-regular/48/dashboard-layout.png",
  default: "https://img.icons8.com/fluency-systems-regular/48/module.png"
};

const im3State = { metadata:null, modules:[], moduleIndex:0, currentModule:null, currentRows:[], currentSelected:null, dropdowns:{}, filterOptions:{}, filters:{}, charts:{}, chartBuilt:false, summaryView:"production_summary" };


const IM3_SUMMARY_VIEWS = [
  { id:"production_summary", title:"Production Summary" },
  { id:"price_summary", title:"Price Module Summary" },
  { id:"cost_summary", title:"Cost Module Summary" },
  { id:"dcf_summary", title:"DCF Summary" },
  { id:"dcf_results_summary", title:"DCF Results Summary" },
  { id:"adjusted_scenario_outputs", title:"Adjusted Scenario Outputs" },
  { id:"map_dnpv_summary", title:"MAP/DNPV Summary" },
  { id:"rov_summary", title:"ROV Summary" },
  { id:"mcda_summary", title:"MCDA Summary" },
  { id:"system_dynamics_summary", title:"System Dynamics Summary" },
  { id:"sd_parameter_summary", title:"SD Parameter Summary" },
  { id:"monte_carlo_summary", title:"Monte Carlo Summary" }
];

function im3PrettyLabel(value) {
  if (value === undefined || value === null) return "";
  let label = im3StripUiNumbering(String(value).trim()).replace(/_/g," ").replace(/\s+/g," ");
  label = label.replace(/\bID\b/g,"Id").replace(/\b([A-Za-z]+) Id\b/g,"$1").replace(/\bId\b$/g,"").trim();
  return label.split(" ").map(w => /^(USD|IRR|NPV|DNPV|MCDA|ROV|CAPEX|OPEX|FX|ESG|FID|API|DCF|SD)$/i.test(w) ? w.toUpperCase() : (/^\d+$/.test(w) ? w : w.charAt(0).toUpperCase()+w.slice(1).toLowerCase())).join(" ");
}
function im3CleanOptionLabel(option) { const raw=String(option ?? "").trim(); if(!raw) return ""; if(/^[A-Z]{2,8}-\d{2,6}\s+[—-]\s+/.test(raw)) return raw.replace(/^[A-Z]{2,8}-\d{2,6}\s+[—-]\s+/,"").trim(); return im3PrettyLabel(raw); }
function im3Encode(obj) { const utf8=new TextEncoder().encode(JSON.stringify(obj)); let binary=""; utf8.forEach(b=>binary+=String.fromCharCode(b)); return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,""); }
function im3Esc(v) { return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function im3StripUiNumbering(value) {
  return String(value ?? "")
    .replace(/^\s*\d{1,3}\s*[_.,:;\-–—]+\s*/g, "")
    .replace(/^\s*\d{1,3}\s+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function im3ModuleLabel(module) {
  const raw = module?.title || module?.name || module?.label || module?.id || "Module";
  return im3StripUiNumbering(im3PrettyLabel(raw));
}
function im3IsHiddenModule(module) {
  const raw = [module?.id, module?.title, module?.name, module?.label]
    .filter(Boolean)
    .map(v => String(v).toLowerCase().replace(/\s+/g, "").replace(/-/g, "_").trim());
  return raw.some(v => v === "00_config" || v === "00config" || v === "config" || v.includes("00_config"));
}
function im3IconFor(id) { return ICONS8[id] || ICONS8.default; }

function im3Jsonp(action, params={}, timeoutMs=30000) {
  return new Promise((resolve,reject)=>{
    const cb="im3_cb_"+Math.random().toString(36).slice(2);
    const script=document.createElement("script");
    let done=false;
    const timer=setTimeout(()=>{
      if(done) return;
      done=true;
      delete window[cb];
      script.remove();
      reject("Request timeout: "+action);
    }, timeoutMs);

    window[cb]=(resp)=>{
      if(done) return;
      done=true;
      clearTimeout(timer);
      delete window[cb];
      script.remove();
      if(!resp || !resp.ok) reject((resp && resp.error) || "API error");
      else resolve(resp.data);
    };

    const query=new URLSearchParams({action,callback:cb,_ts:String(Date.now()),...params});
    script.src=IM3_API_URL+"?"+query.toString();
    script.onerror=()=>{
      if(done) return;
      done=true;
      clearTimeout(timer);
      delete window[cb];
      reject("Failed to reach Apps Script API. Check deployment URL and access permissions.");
    };
    document.body.appendChild(script);
  });
}
function im3ShowAlert(msg,type="info") { const el=document.getElementById("im3Alert"); el.textContent=msg; el.className="im3-alert "+type; setTimeout(()=>el.classList.add("hidden"),5000); }

function im3Loading(percent, text) {
  const loading = document.getElementById("im3LoadingScreen");
  const bar = document.getElementById("im3LoadingFill");
  const status = document.getElementById("im3LoadingStatus");
  const pct = document.getElementById("im3LoadingPercent");
  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
  if (loading) {
    loading.classList.remove("hidden");
    loading.setAttribute("aria-busy", safePercent >= 100 ? "false" : "true");
  }
  if (bar) bar.style.width = safePercent + "%";
  if (status && text) status.textContent = text;
  if (pct) pct.textContent = Math.round(safePercent) + "%";
}

function im3FinishLoading() {
  im3Loading(100, "Model successfully loaded.");
  setTimeout(() => {
    const loading = document.getElementById("im3LoadingScreen");
    if (loading) loading.classList.add("hidden");
  }, 650);
}

function im3LoadingError(message) {
  im3Loading(100, "Loading failed. Please check the Google Sheets API connection.");
  const status = document.getElementById("im3LoadingStatus");
  if (status) status.textContent = String(message || "Initialization error");
}

async function im3Init() {
  try {
    im3Loading(8, "Connecting...");
    im3ShowAlert("Connecting to optimized Google Sheets API...", "info");

    im3State.metadata = await im3Jsonp("metadatafast", {}, 35000).catch(() => im3Jsonp("metadata", {}, 35000));
    im3Loading(26, "Synchronizing workbook structure...");

    im3State.modules = (im3State.metadata.modules || [])
      .filter(m => !["decision_report", "tilda_output"].includes(String(m.id || "").toLowerCase()))
      .filter(m => !im3IsHiddenModule(m))
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

    im3Loading(42, "Loading filters and dropdown lists...");
    const filtersPromise = im3Jsonp("filteroptions", {}, 35000).catch(() => im3State.metadata.filters || {});
    const dropdownsPromise = im3Jsonp("dropdowns", { scope:"all" }, 35000).catch(() => im3State.metadata.dropdowns || {});
    const loaded = await Promise.all([filtersPromise, dropdownsPromise]);
    im3State.filterOptions = loaded[0] || {};
    im3State.dropdowns = loaded[1] || {};
    im3State.metadata.filters = im3State.filterOptions;
    im3State.metadata.dropdowns = im3State.dropdowns;

    im3RenderFilters();
    im3RenderAnalysisProjectSelect();
    im3RenderSummarySelector();
    im3RenderChartControls();
    im3RenderSteps();

    im3Loading(70, "Synchronizing model data...");
    await im3LoadModuleByIndex(0);

    im3Loading(88, "Preparing dashboard and result viewer...");
    await im3LoadDashboard();
    await im3LoadSelectedSummary();

    im3FinishLoading();
    im3ShowAlert("Model data loaded. Select a project, result table or graph template to analyze outputs.", "success");
  } catch(err) {
    im3LoadingError(err);
    im3ShowAlert("Initialization error: " + err, "error");
    console.error("IM3 initialization error", err);
  }
}

function im3PrepareDropdownDirection(root) {
  const rect = root.getBoundingClientRect();
  const viewportH = window.innerHeight || document.documentElement.clientHeight;
  const spaceBelow = viewportH - rect.bottom;
  const spaceAbove = rect.top;
  root.classList.toggle("open-up", spaceBelow < 280 && spaceAbove > spaceBelow);
}

function im3CloseAllDropdowns() {
  document.querySelectorAll(".im3-multiselect.open, .im3-form-ms.open").forEach(el => {
    el.classList.remove("open");
    el.classList.remove("open-up");
  });
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".im3-multiselect") && !e.target.closest(".im3-form-ms")) {
    im3CloseAllDropdowns();
  }
});

function im3UpdateMultiSelect(root) {
  const selected = Array.from(root.querySelectorAll('input[type="checkbox"]:checked'));
  const values = selected.map(i => i.value);
  root.dataset.values = JSON.stringify(values);

  const placeholder = root.querySelector(".im3-ms-placeholder");
  const count = root.querySelector(".im3-ms-count");
  const labels = selected.slice(0, 2).map(i => i.closest(".im3-ms-option").querySelector(".im3-ms-label").textContent);

  placeholder.textContent = values.length ? labels.join(", ") + (values.length > 2 ? ` +${values.length - 2}` : "") : (root.dataset.placeholder || "Select");
  count.textContent = values.length;
  count.style.display = values.length ? "inline-flex" : "none";
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".im3-multiselect") && !e.target.closest(".im3-form-ms") && !e.target.closest(".im3-ms-panel")) {
    im3CloseAllDropdowns();
  }
});

function im3RenderFilters() {
  const f = im3State.filterOptions || im3State.metadata.filters || {};
  fillSearchableMulti("filterProjects", f.projectIds || []);
  fillSearchableMulti("filterAssumptions", f.assumptionSetIds || []);
  fillSearchableMulti("filterScenarios", f.scenarioIds || []);
  fillSearchableMulti("filterYears", f.years || []);
  fillSearchableMulti("filterProjectTypes", f.projectTypes || []);
  fillSearchableMulti("filterLocations", f.locations || []);
  fillSearchableMulti("filterMetrics", im3State.metadata.chartMetrics || []);
}

function im3RenderSummarySelector() {
  const select = document.getElementById("im3SummarySelect");
  if (!select) return;
  select.innerHTML = IM3_SUMMARY_VIEWS.map(v => `<option value="${im3Esc(v.id)}">${im3Esc(v.title)}</option>`).join("");
  select.value = im3State.summaryView || IM3_SUMMARY_VIEWS[0].id;
  select.onchange = () => {
    im3State.summaryView = select.value;
    im3LoadSelectedSummary();
  };
}

function im3GetCurrentProjectId() {
  const selected = im3State.currentSelected || {};
  return selected.Project_ID || selected.project_id || selected.ProjectId || "";
}

function im3SetMultiSelectValues(id, values) {
  const root = document.getElementById(id);
  if (!root) return;
  const set = new Set((values || []).map(v => String(v)));
  root.querySelectorAll('input[type="checkbox"]').forEach(i => { i.checked = set.has(String(i.value)); });
  im3UpdateMultiSelect(root);
}

async function im3RefreshOutputsOnly() {
  await im3LoadDashboard();
  await im3LoadSelectedSummary();
  if (im3State.chartBuilt) await im3BuildChart();
}



const IM3_GRAPH_TEMPLATES = [
  {
    id: "executive_ranking",
    title: "Project ranking",
    description: "Ranks selected projects by integrated score, NPV, IRR or other decision metric.",
    icon: "https://img.icons8.com/fluency-systems-regular/48/sort-amount-down.png",
    defaultMetric: "Integrated_Score",
    defaultGroupBy: "Project_Name",
    defaultTimeField: "Project_Name",
    defaultChart: "bar",
    allowedCharts: ["bar"],
    xLabel: "Project",
    metricLabel: "Ranking metric",
    groupLabel: "Rank projects by",
    timeLabel: "Project field"
  },
  {
    id: "financial_timeline",
    title: "Financial timeline",
    description: "Shows financial performance over time for selected projects or scenarios.",
    icon: "https://img.icons8.com/fluency-systems-regular/48/combo-chart.png",
    defaultMetric: "NPV_USD",
    defaultGroupBy: "Project_Name",
    defaultTimeField: "Year",
    defaultChart: "line",
    allowedCharts: ["line", "bar"],
    xLabel: "Year",
    metricLabel: "Financial metric",
    groupLabel: "Compare series by",
    timeLabel: "Time field"
  },
  {
    id: "cashflow_waterfall_proxy",
    title: "Value bridge / waterfall proxy",
    description: "Compares revenue, CAPEX, OPEX and value metrics as a simplified value bridge.",
    icon: "https://img.icons8.com/fluency-systems-regular/48/waterfall-chart.png",
    defaultMetric: "Revenue_USD",
    defaultGroupBy: "__sourceSheet",
    defaultTimeField: "__sourceSheet",
    defaultChart: "bar",
    allowedCharts: ["bar"],
    xLabel: "Value component",
    metricLabel: "Value metric",
    groupLabel: "Component / module",
    timeLabel: "Component field"
  },
  {
    id: "risk_sensitivity",
    title: "Sensitivity / tornado",
    description: "Shows which variable has the strongest impact on project value.",
    icon: "https://img.icons8.com/fluency-systems-regular/48/tune.png",
    defaultMetric: "NPV_Change_USD",
    defaultGroupBy: "Sensitivity_Variable",
    defaultTimeField: "Sensitivity_Variable",
    defaultChart: "bar",
    allowedCharts: ["bar"],
    xLabel: "Sensitivity variable",
    metricLabel: "Impact metric",
    groupLabel: "Sensitivity variable",
    timeLabel: "Variable field"
  },
  {
    id: "monte_carlo",
    title: "Monte Carlo result",
    description: "Visualizes simulation output by run, project or probability band.",
    icon: "https://img.icons8.com/fluency-systems-regular/48/dice.png",
    defaultMetric: "Monte_Carlo_Mean_NPV",
    defaultGroupBy: "Project_Name",
    defaultTimeField: "Run_No",
    defaultChart: "bar",
    allowedCharts: ["bar", "line"],
    xLabel: "Simulation run / bucket",
    metricLabel: "Simulation metric",
    groupLabel: "Compare simulations by",
    timeLabel: "Run or bucket field"
  },
  {
    id: "mcda_profile",
    title: "MCDA profile",
    description: "Compares strategic criteria, weights or scores for selected projects.",
    icon: "https://img.icons8.com/fluency-systems-regular/48/rating.png",
    defaultMetric: "MCDA_Score",
    defaultGroupBy: "Criterion_ID",
    defaultTimeField: "Criterion_ID",
    defaultChart: "radar",
    allowedCharts: ["radar", "bar", "doughnut"],
    xLabel: "Criterion",
    metricLabel: "MCDA metric",
    groupLabel: "Criteria / dimension",
    timeLabel: "Criteria field"
  },
  {
    id: "system_dynamics",
    title: "System Dynamics over time",
    description: "Shows dynamic behavior of capacity, production, investment or system score over time.",
    icon: "https://img.icons8.com/fluency-systems-regular/48/process.png",
    defaultMetric: "System_Dynamics_Score",
    defaultGroupBy: "Project_Name",
    defaultTimeField: "Year",
    defaultChart: "line",
    allowedCharts: ["line", "bar"],
    xLabel: "Year",
    metricLabel: "Dynamic metric",
    groupLabel: "Compare by",
    timeLabel: "Time field"
  },
  {
    id: "decision_matrix",
    title: "Decision matrix",
    description: "Plots projects by two decision indicators, such as NPV versus IRR or MCDA versus risk.",
    icon: "https://img.icons8.com/fluency-systems-regular/48/scatter-plot.png",
    defaultMetric: "IRR",
    defaultGroupBy: "NPV_USD",
    defaultTimeField: "Project_Name",
    defaultChart: "scatter",
    allowedCharts: ["scatter"],
    xLabel: "X metric",
    metricLabel: "Y-axis metric",
    groupLabel: "X-axis metric",
    timeLabel: "Point label"
  },
  {
    id: "scenario_comparison",
    title: "Scenario comparison",
    description: "Compares selected scenarios for a chosen financial or strategic metric.",
    icon: "https://img.icons8.com/fluency-systems-regular/48/compare.png",
    defaultMetric: "NPV_USD",
    defaultGroupBy: "Scenario_Name",
    defaultTimeField: "Scenario_Name",
    defaultChart: "bar",
    allowedCharts: ["bar", "line"],
    xLabel: "Scenario",
    metricLabel: "Scenario metric",
    groupLabel: "Compare scenarios by",
    timeLabel: "Scenario field"
  }
];

const IM3_GRAPH_FIELDS = [
  { value: "Project_Name", label: "Project" },
  { value: "Scenario_Name", label: "Scenario" },
  { value: "Project_Type", label: "Project type" },
  { value: "Location", label: "Location" },
  { value: "Year", label: "Year" },
  { value: "Run_No", label: "Simulation run" },
  { value: "Criterion_ID", label: "MCDA criterion" },
  { value: "Sensitivity_Variable", label: "Sensitivity variable" },
  { value: "Probability_Band", label: "Probability band" },
  { value: "__sourceSheet", label: "Model module" },
  { value: "NPV_USD", label: "NPV" },
  { value: "IRR", label: "IRR" },
  { value: "MCDA_Score", label: "MCDA score" },
  { value: "System_Dynamics_Score", label: "System Dynamics score" },
  { value: "Integrated_Score", label: "Integrated score" }
];

const IM3_EXTRA_METRICS = [
  { value: "NPV_Change_USD", label: "NPV change" },
  { value: "Adjusted_NPV_USD", label: "Adjusted NPV" },
  { value: "Simulated_NPV_USD", label: "Simulated NPV" },
  { value: "Manual_Score_1_10", label: "Manual score" },
  { value: "Weight_%", label: "Criteria weight" },
  { value: "Production_Capacity", label: "Production capacity" },
  { value: "Investment_Flow", label: "Investment flow" },
  { value: "Revenue_Flow", label: "Revenue flow" },
  { value: "OPEX_Flow", label: "OPEX flow" }
];

function im3AllChartMetrics() {
  const source = [...(im3State.metadata.chartMetrics || []), ...IM3_EXTRA_METRICS];
  const seen = new Set();
  return source.filter(m => {
    if (seen.has(m.value)) return false;
    seen.add(m.value);
    return true;
  });
}

function im3RenderChartControls() {
  const templateSelect = document.getElementById("chartTemplate");
  templateSelect.innerHTML = IM3_GRAPH_TEMPLATES.map(t => `<option value="${im3Esc(t.id)}">${im3Esc(t.title)}</option>`).join("");

  document.getElementById("chartMetric").innerHTML = im3AllChartMetrics().map(m => `<option value="${im3Esc(m.value)}">${im3Esc(m.label)}</option>`).join("");
  document.getElementById("chartGroupBy").innerHTML = IM3_GRAPH_FIELDS.map(f => `<option value="${im3Esc(f.value)}">${im3Esc(f.label)}</option>`).join("");
  document.getElementById("chartTimeField").innerHTML = IM3_GRAPH_FIELDS.map(f => `<option value="${im3Esc(f.value)}">${im3Esc(f.label)}</option>`).join("");

  im3RenderTemplateList();
  im3ApplyGraphTemplate(IM3_GRAPH_TEMPLATES[0].id);
}

function im3RenderTemplateList() {
  const box = document.getElementById("im3GraphTemplateList");
  box.innerHTML = IM3_GRAPH_TEMPLATES.map(t => `
    <button class="im3-graph-template" type="button" data-template="${im3Esc(t.id)}">
      <img src="${im3Esc(t.icon)}" alt="">
      <span><strong>${im3Esc(t.title)}</strong><small>${im3Esc(t.description)}</small></span>
    </button>
  `).join("");

  box.querySelectorAll(".im3-graph-template").forEach(btn => {
    btn.addEventListener("click", () => im3ApplyGraphTemplate(btn.dataset.template));
  });
}

function im3ApplyGraphTemplate(templateId) {
  const template = IM3_GRAPH_TEMPLATES.find(t => t.id === templateId) || IM3_GRAPH_TEMPLATES[0];
  document.getElementById("chartTemplate").value = template.id;
  document.getElementById("chartMetric").value = template.defaultMetric;
  document.getElementById("chartGroupBy").value = template.defaultGroupBy;
  document.getElementById("chartTimeField").value = template.defaultTimeField;
  document.getElementById("chartDisplayType").value = "auto";

  document.getElementById("chartMetricLabel").textContent = template.metricLabel || "Metric";
  document.getElementById("chartGroupLabel").textContent = template.groupLabel || "Compare by";
  document.getElementById("chartTimeLabel").textContent = template.timeLabel || "X-axis";
  document.getElementById("im3GraphHint").textContent = template.description;

  document.querySelectorAll(".im3-graph-template").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.template === template.id);
  });

  const display = document.getElementById("chartDisplayType");
  Array.from(display.options).forEach(o => {
    o.disabled = o.value !== "auto" && !template.allowedCharts.includes(o.value);
  });
}

function im3SelectedGraphTemplate() {
  return IM3_GRAPH_TEMPLATES.find(t => t.id === document.getElementById("chartTemplate").value) || IM3_GRAPH_TEMPLATES[0];
}

function im3PreferredChartType(template, labels) {
  const selected = document.getElementById("chartDisplayType").value;
  if (selected !== "auto") return selected;
  if (template.defaultChart === "line" && labels.length > 2) return "line";
  return template.defaultChart || "bar";
}

async function im3BuildChart() {
  try {
    const template = im3SelectedGraphTemplate();
    const metric = document.getElementById("chartMetric").value || template.defaultMetric;
    const groupBy = document.getElementById("chartGroupBy").value || template.defaultGroupBy;
    const timeField = document.getElementById("chartTimeField").value || template.defaultTimeField;

    document.getElementById("advancedChartTitle").textContent = template.title + " — " + im3PrettyLabel(metric);

    if (template.id === "decision_matrix") {
      im3State.chartBuilt=true;
      await im3BuildDecisionMatrix(metric, groupBy, timeField);
      return;
    }

    const data = await im3Jsonp("chartdata", { filters: im3FilterParam(), metric, groupBy, timeField });
    const rows = data.data || [];
    if (!rows.length) {
      im3ShowAlert("No data found for this graph and selected parameters.", "info");
      im3ClearActiveChart();
      im3State.chartBuilt=false;
      return;
    }

    im3State.chartBuilt=true;
    const labels = [...new Set(rows.map(d => d.x))];
    const series = [...new Set(rows.map(d => d.series))].slice(0, 8);
    const type = im3PreferredChartType(template, labels);

    if (type === "radar") return im3RenderRadarChart(template, labels, series, rows, metric);
    if (type === "doughnut") return im3RenderDoughnutChart(template, labels, rows, metric);

    const colors = im3ChartColors();
    const datasets = series.map((s, idx) => ({
      label: im3CleanOptionLabel(s),
      data: labels.map(x => {
        const found = rows.find(d => String(d.x) === String(x) && String(d.series) === String(s));
        return found ? found.value : null;
      }),
      borderColor: colors[idx % colors.length],
      backgroundColor: type === "line" ? colors[idx % colors.length] : colors[idx % colors.length],
      borderWidth: 2.5,
      tension: .25,
      fill: false,
      borderRadius: type === "bar" ? 6 : 0
    }));

    im3DestroyActiveChart();
    im3State.charts.advanced = new Chart(document.getElementById("im3AdvancedChart"), {
      type,
      data: { labels, datasets },
      options: im3ChartOptions(type, template, metric)
    });
  } catch(err) {
    im3ShowAlert("Chart error: " + err, "error");
  }
}

async function im3BuildDecisionMatrix(yMetric, xMetric, labelField) {
  const data = await im3Jsonp("dashboard", { filters: im3FilterParam() });
  const rows = data.rows || [];
  if (!rows.length) {
    im3ShowAlert("No dashboard rows available for decision matrix.", "info");
    im3ClearActiveChart();
    return;
  }

  const points = rows.map(r => ({
    x: im3NumberValue(r[xMetric]),
    y: im3NumberValue(r[yMetric]),
    label: r[labelField] || r.Project_Name || r.Project_ID || "Project"
  })).filter(p => !isNaN(p.x) && !isNaN(p.y));

  im3DestroyActiveChart();
  im3State.charts.advanced = new Chart(document.getElementById("im3AdvancedChart"), {
    type: "scatter",
    data: {
      datasets: [{
        label: im3PrettyLabel(yMetric) + " vs " + im3PrettyLabel(xMetric),
        data: points,
        backgroundColor: "#193A64",
        borderColor: "#193A64",
        pointRadius: 6,
        pointHoverRadius: 8
      }]
    },
    options: {
      responsive: true,
      parsing: false,
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.raw.label}: ${im3PrettyLabel(xMetric)} ${ctx.raw.x}, ${im3PrettyLabel(yMetric)} ${ctx.raw.y}`
          }
        }
      },
      scales: {
        x: { title: { display: true, text: im3PrettyLabel(xMetric) }, grid: { color: "rgba(25,58,100,.10)" } },
        y: { title: { display: true, text: im3PrettyLabel(yMetric) }, grid: { color: "rgba(25,58,100,.10)" } }
      }
    }
  });
}

function im3RenderRadarChart(template, labels, series, rows, metric) {
  const colors = im3ChartColors();
  const datasetName = series[0] || metric;
  const values = labels.map(x => {
    const found = rows.find(d => String(d.x) === String(x));
    return found ? found.value : 0;
  });
  im3DestroyActiveChart();
  im3State.charts.advanced = new Chart(document.getElementById("im3AdvancedChart"), {
    type: "radar",
    data: {
      labels: labels.slice(0, 12).map(im3CleanOptionLabel),
      datasets: [{
        label: im3CleanOptionLabel(datasetName),
        data: values.slice(0, 12),
        borderColor: colors[0],
        backgroundColor: "rgba(25,58,100,.18)",
        pointBackgroundColor: colors[0],
        borderWidth: 2
      }]
    },
    options: { responsive: true, plugins: { legend: { position: "bottom" } }, scales: { r: { beginAtZero: true } } }
  });
}

function im3RenderDoughnutChart(template, labels, rows, metric) {
  const grouped = {};
  rows.forEach(r => grouped[r.x] = (grouped[r.x] || 0) + Number(r.value || 0));
  const entries = Object.entries(grouped).slice(0, 10);
  im3DestroyActiveChart();
  im3State.charts.advanced = new Chart(document.getElementById("im3AdvancedChart"), {
    type: "doughnut",
    data: {
      labels: entries.map(e => im3CleanOptionLabel(e[0])),
      datasets: [{ data: entries.map(e => e[1]), backgroundColor: im3ChartColors() }]
    },
    options: { responsive: true, plugins: { legend: { position: "bottom" } }, cutout: "62%" }
  });
}

function im3ChartColors() {
  return ["#193A64", "#2B4970", "#F9DA7B", "#536C8F", "#8DA0BA", "#B68A18", "#10263F", "#EAC85E"];
}

function im3ChartOptions(type, template, metric) {
  const isHorizontal = template.id === "executive_ranking" || template.id === "risk_sensitivity";
  return {
    indexAxis: isHorizontal && type === "bar" ? "y" : "x",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" },
      tooltip: { mode: "nearest", intersect: false }
    },
    scales: {
      x: { title: { display: true, text: template.xLabel || "Category" }, grid: { display: false } },
      y: { title: { display: true, text: im3PrettyLabel(metric) }, beginAtZero: false, grid: { color: "rgba(25,58,100,.10)" } }
    }
  };
}

function im3DestroyActiveChart() {
  if (im3State.charts.advanced) {
    im3State.charts.advanced.destroy();
    im3State.charts.advanced = null;
  }
}

function im3ClearActiveChart() { im3State.chartBuilt=false;
  im3DestroyActiveChart();
  document.getElementById("advancedChartTitle").textContent = "No graph rendered yet";
}

function im3NumberValue(value) {
  if (value === undefined || value === null || value === "") return NaN;
  const raw = String(value);
  const n = Number(raw.replace(/,/g, "").replace(/%/g, "").replace(/[^0-9.-]/g, ""));
  if (isNaN(n)) return NaN;
  if (raw.includes("%") && Math.abs(n) > 1) return n / 100;
  return n;
}

function im3RenderScoreChart(summary) {
  const canvas = document.getElementById("im3ScoreChart");
  if (!canvas) return;
  if(im3State.charts.score) im3State.charts.score.destroy();
  im3State.charts.score=new Chart(canvas,{ type:"bar", data:{ labels:["MCDA","System Dynamics","Integrated"], datasets:[{ label:"Score", data:[summary.avgMCDA||0,summary.avgSD||0,summary.avgIntegratedScore||0], backgroundColor:["#193A64","#2B4970","#F9DA7B"], borderRadius:6 }] }, options:{ responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true,max:100}, x:{grid:{display:false}}} } });
}



/* ===== IM3 TILDA CORE FIXES — missing runtime functions added ===== */
function im3NormalizeOption(item) {
  if (item && typeof item === "object") {
    const value = item.value ?? item.id ?? item.key ?? item.name ?? item.label ?? "";
    const label = item.label ?? item.name ?? item.title ?? item.value ?? value;
    return { value: String(value), label: im3CleanOptionLabel(label) };
  }
  return { value: String(item ?? ""), label: im3CleanOptionLabel(item) };
}

function fillSearchableMulti(id, items) {
  const root = document.getElementById(id);
  if (!root) return;
  const options = (items || []).map(im3NormalizeOption).filter(o => o.value !== "");
  const placeholder = root.dataset.placeholder || "Select";
  root.innerHTML = `
    <button class="im3-ms-control" type="button">
      <span class="im3-ms-placeholder">${im3Esc(placeholder)}</span>
      <span class="im3-ms-count" style="display:none">0</span>
    </button>
    <div class="im3-ms-panel">
      <input class="im3-ms-search" type="search" placeholder="Search...">
      <div class="im3-ms-actions">
        <button class="im3-ms-mini" type="button" data-action="all">All</button>
        <button class="im3-ms-mini" type="button" data-action="none">Clear</button>
      </div>
      <div class="im3-ms-options">
        ${options.map(o => `
          <label class="im3-ms-option">
            <input type="checkbox" value="${im3Esc(o.value)}">
            <span class="im3-ms-box"></span>
            <span class="im3-ms-label">${im3Esc(o.label)}</span>
          </label>`).join("")}
      </div>
    </div>`;

  const control = root.querySelector(".im3-ms-control");
  const search = root.querySelector(".im3-ms-search");
  control.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasOpen = root.classList.contains("open");
    im3CloseAllDropdowns();
    if (!wasOpen) {
      root.classList.add("open");
      im3PrepareDropdownDirection(root);
      if (search) search.focus();
    }
  });
  root.querySelectorAll('input[type="checkbox"]').forEach(input => input.addEventListener("change", () => im3UpdateMultiSelect(root)));
  root.querySelectorAll(".im3-ms-mini").forEach(btn => btn.addEventListener("click", () => {
    const checked = btn.dataset.action === "all";
    root.querySelectorAll('.im3-ms-option:not([style*="display: none"]) input[type="checkbox"]').forEach(i => i.checked = checked);
    im3UpdateMultiSelect(root);
  }));
  if (search) search.addEventListener("input", () => {
    const q = search.value.toLowerCase().trim();
    root.querySelectorAll(".im3-ms-option").forEach(opt => {
      opt.style.display = opt.textContent.toLowerCase().includes(q) ? "" : "none";
    });
  });
  im3UpdateMultiSelect(root);
}

function im3MultiValues(id) {
  const el = document.getElementById(id);
  if (!el) return [];
  try { return JSON.parse(el.dataset.values || "[]"); } catch(e) { return []; }
}

function im3CollectFilters() {
  im3State.filters = {
    projectIds: im3MultiValues("filterProjects"),
    assumptionSetIds: im3MultiValues("filterAssumptions"),
    scenarioIds: im3MultiValues("filterScenarios"),
    years: im3MultiValues("filterYears"),
    projectTypes: im3MultiValues("filterProjectTypes"),
    locations: im3MultiValues("filterLocations"),
    metrics: im3MultiValues("filterMetrics")
  };
  return im3State.filters;
}

function im3FilterParam() {
  return im3Encode(im3CollectFilters());
}

function im3ClearFilters() {
  document.querySelectorAll(".im3-multiselect").forEach(root => {
    root.querySelectorAll('input[type="checkbox"]').forEach(i => i.checked = false);
    im3UpdateMultiSelect(root);
  });
  im3CollectFilters();
  im3ApplyFilters();
}

function im3SetProgress(index) {
  const total = Math.max(im3State.modules.length, 1);
  const pct = Math.round(((index + 1) / total) * 100);
  const text = document.getElementById("im3ProgressText");
  const fill = document.getElementById("im3ProgressFill");
  if (text) text.textContent = pct + "%";
  if (fill) fill.style.width = pct + "%";
}

function im3RenderSteps() {
  const nav = document.getElementById("im3Steps");
  if (!nav) return;
  nav.innerHTML = im3State.modules.map((m, idx) => `
    <button class="im3-step ${idx === im3State.moduleIndex ? "active" : ""}" type="button" data-index="${idx}">
      <span class="im3-step-icon"><img src="${im3Esc(im3IconFor(m.id))}" alt=""></span>
      <strong>${im3Esc(im3ModuleLabel(m))}</strong>
    </button>`).join("");
  nav.querySelectorAll(".im3-step").forEach(btn => btn.addEventListener("click", () => im3LoadModuleByIndex(Number(btn.dataset.index))));
  im3SetProgress(im3State.moduleIndex);
}

async function im3LoadModuleByIndex(index) {
  if (!im3State.modules.length) throw "No modules returned by metadata endpoint.";
  const safeIndex = Math.min(Math.max(Number(index) || 0, 0), im3State.modules.length - 1);
  im3State.moduleIndex = safeIndex;
  const mod = im3State.modules[safeIndex];
  await im3LoadModule(mod.id, "");
  im3RenderSteps();
}

async function im3LoadModule(moduleId, rowId="") {
  const params = { moduleId, filters: im3FilterParam() };
  if (rowId) params.key = rowId;
  const data = await im3Jsonp("module", params, 35000);
  const moduleMeta = data.module || im3State.modules.find(m => m.id === moduleId) || { id: moduleId };
  const rows = data.rows || data.data || [];
  const selected = data.selected || data.current || rows[0] || {};
  im3State.currentModule = moduleMeta;
  im3State.currentRows = rows;
  im3State.currentSelected = selected;

  document.getElementById("im3ModuleTitle").textContent = im3ModuleLabel(moduleMeta);
  document.getElementById("im3ModuleDescription").textContent = moduleMeta.description || `Loaded ${rows.length} row(s) from Google Sheets.`;
  im3RenderRowSelect(rows, selected, moduleMeta);
  im3RenderForm(moduleMeta, selected, data.headers || data.fields || Object.keys(selected));
  im3RenderTable("im3Table", rows, 100);
  im3SetProgress(im3State.moduleIndex);
}

function im3RenderRowSelect(rows, selected, moduleMeta={}) {
  const sel = document.getElementById("im3RowSelect");
  if (!sel) return;
  const keyColumn = moduleMeta.keyColumn || "";
  const currentId = selected[keyColumn] || selected.Row_ID || selected.ID || selected.Project_ID || selected.id || "";
  sel.innerHTML = (rows || []).map((r, idx) => {
    const id = r[keyColumn] || r.Row_ID || r.ID || r.Project_ID || r.id || String(idx + 1);
    const label = r.Project_Name || r.Name || r.Scenario_Name || r.Parameter_Name || r.Parameter || r[keyColumn] || id;
    return `<option value="${im3Esc(id)}" ${String(id) === String(currentId) ? "selected" : ""}>${im3Esc(im3CleanOptionLabel(label))}</option>`;
  }).join("");
  sel.onchange = async () => {
    await im3LoadModule(im3State.currentModule.id, sel.value);
    const projectId = im3GetCurrentProjectId();
    if (projectId) {
      const analysisSelect = document.getElementById("im3AnalysisProjectSelect");
      if (analysisSelect && Array.from(analysisSelect.options).some(o => String(o.value) === String(projectId))) analysisSelect.value = projectId;
      im3SetMultiSelectValues("filterProjects", [projectId]);
      im3CollectFilters();
      await im3RefreshOutputsOnly();
    }
  };
}


function im3FieldIsReadonly(key, value, moduleMeta={}) {
  const editable = new Set(moduleMeta.editableFields || []);
  if (moduleMeta.readOnly) return true;
  if (key === moduleMeta.keyColumn || key === "__rowNumber" || key === "Row_ID" || key === "ID") return true;
  if (typeof value === "string" && value.trim().startsWith("=")) return true;
  if (/^(__|formula_|calculated_)/i.test(key)) return true;
  return editable.size ? !editable.has(key) : false;
}

function im3DropdownOptions(moduleMeta, key, value) {
  const source = (moduleMeta.dropdowns || {})[key] || key || im3PrettyLabel(key);
  let options = im3State.dropdowns[source] || im3State.dropdowns[key] || im3State.dropdowns[im3PrettyLabel(key)] || [];
  options = Array.isArray(options) ? options.map(im3NormalizeOption).filter(o => o.value !== "") : [];
  if (value !== undefined && value !== null && value !== "" && !options.some(o => String(o.value) === String(value))) {
    options.unshift({ value:String(value), label:im3CleanOptionLabel(value) });
  }
  return options;
}

function im3RenderForm(moduleMeta, row, fields) {
  const form = document.getElementById("im3Form");
  if (!form) return;
  const headers = (Array.isArray(fields) ? fields.map(f => typeof f === "string" ? f : (f.key || f.name || f.id)).filter(Boolean) : Object.keys(row || {}));
  const keys = headers.filter(k => k && !String(k).startsWith("__"));
  if (!keys.length) { form.innerHTML = `<div class="im3-readonly">No data returned for this module.</div>`; return; }
  form.innerHTML = keys.map(key => {
    const value = row?.[key] ?? "";
    const readonly = im3FieldIsReadonly(key, value, moduleMeta);
    const label = im3Esc(im3PrettyLabel(key));
    if (readonly) return `<label class="im3-field"><span>${label}</span><input name="${im3Esc(key)}" value="${im3Esc(value)}" readonly></label>`;
    const opts = im3DropdownOptions(moduleMeta, key, value);
    if (opts.length) {
      return `<label class="im3-field"><span>${label}</span><select name="${im3Esc(key)}">${opts.map(o => `<option value="${im3Esc(o.value)}" ${String(o.value) === String(value) ? "selected" : ""}>${im3Esc(o.label)}</option>`).join("")}</select></label>`;
    }
    const type = /year|date/i.test(key) ? "text" : (/rate|irr|npv|cost|price|capex|opex|score|usd|percent|%|volume|capacity|production|tax|factor|amount|quantity|probability|value/i.test(key) ? "number" : "text");
    return `<label class="im3-field"><span>${label}</span><input name="${im3Esc(key)}" type="${type}" step="any" value="${im3Esc(value)}"></label>`;
  }).join("");
}


function im3RenderTable(tableId, rows, maxRows=50) {
  const table = document.getElementById(tableId);
  if (!table) return;
  if (!rows || !rows.length) { table.innerHTML = `<tbody><tr><td>No data available.</td></tr></tbody>`; return; }
  const keys = Object.keys(rows[0]).filter(k => !String(k).startsWith("__")).slice(0, 14);
  table.innerHTML = `<thead><tr>${keys.map(k => `<th>${im3Esc(im3PrettyLabel(k))}</th>`).join("")}</tr></thead><tbody>${rows.slice(0, maxRows).map(r => `<tr>${keys.map(k => `<td>${im3Esc(r[k])}</td>`).join("")}</tr>`).join("")}</tbody>`;
}

async function im3LoadDashboard() {
  const data = await im3Jsonp("dashboard", { filters: im3FilterParam() }, 35000);
  const summary = data.summary || data.kpis || {};
  const rows = data.rows || data.data || [];
  document.getElementById("dashRows").textContent = data.totalRowsAfterFilter || rows.length || summary.rows || summary.count || 0;
  document.getElementById("dashNpv").textContent = im3FormatKpi(summary.avgNPV ?? summary.avgNpv ?? summary.averageNPV);
  document.getElementById("dashIrr").textContent = im3FormatKpi(summary.avgIRR ?? summary.avgIrr ?? summary.averageIRR, true);
  document.getElementById("dashMcda").textContent = im3FormatKpi(summary.avgMCDA ?? summary.avgMcda);
  document.getElementById("dashSd").textContent = im3FormatKpi(summary.avgSD ?? summary.avgSystemDynamics);
  document.getElementById("dashIntegrated").textContent = im3FormatKpi(summary.avgIntegratedScore ?? summary.avgIntegrated);
  const best = summary.bestProject || summary.best_project || {};
  document.getElementById("dashBest").textContent = typeof best === "object" ? (best.Project_Name || best.Project_ID || "—") : (best || "—");
  document.getElementById("dashDecision").textContent = summary.decision || "Review";
  document.getElementById("dashRisk").textContent = summary.risk || summary.riskLevel || "Filtered output";
}

async function im3LoadSelectedSummary() {
  const select = document.getElementById("im3SummarySelect");
  const table = document.getElementById("im3DashboardTable");
  const meta = document.getElementById("im3SummaryMeta");
  const title = document.getElementById("im3SummaryTitle");
  if (!select || !table) return;
  const viewId = select.value || im3State.summaryView || IM3_SUMMARY_VIEWS[0].id;
  im3State.summaryView = viewId;
  const view = IM3_SUMMARY_VIEWS.find(v => v.id === viewId) || IM3_SUMMARY_VIEWS[0];
  if (title) title.textContent = view.title;
  try {
    const data = await im3Jsonp("summarydata", { view: viewId, filters: im3FilterParam() }, 35000);
    const rows = data.rows || [];
    im3RenderTable("im3DashboardTable", rows, 300);
    if (meta) {
      const kpiText = data.kpis ? Object.entries(data.kpis).map(([k,v]) => `${im3PrettyLabel(k)}: ${v}`).join(" | ") : "";
      meta.textContent = `${data.title || view.title} — ${data.totalRowsAfterFilter ?? rows.length} row(s)` + (data.truncated ? " shown partially" : "") + (kpiText ? ` — ${kpiText}` : "");
    }
  } catch (err) {
    if (meta) meta.textContent = "Could not load this result view: " + err;
    table.innerHTML = `<tbody><tr><td>Could not load this result view.</td></tr></tbody>`;
  }
}


function im3FormatKpi(value, percent=false) {
  const n = im3NumberValue(value);
  if (isNaN(n)) return value ?? "—";
  if (percent) return (Math.abs(n) <= 1 ? n * 100 : n).toFixed(2) + "%";
  if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(2) + "M";
  return Number(n.toFixed(2)).toLocaleString();
}

async function im3SaveCurrent() {
  try {
    if (!im3State.currentModule) return false;
    const form = document.getElementById("im3Form");
    const payload = {};
    Array.from(new FormData(form).entries()).forEach(([k,v]) => payload[k] = v);
    const rowId = document.getElementById("im3RowSelect").value || payload.Row_ID || payload.ID || "";
    await im3Jsonp("save", { moduleId: im3State.currentModule.id, key: rowId, rowId, payload: im3Encode(payload) }, 35000);
    im3ShowAlert("Data saved successfully.", "success");
    await im3LoadModule(im3State.currentModule.id, rowId);
    await im3LoadDashboard();
    return true;
  } catch(err) {
    im3ShowAlert("Save error: " + err, "error");
    return false;
  }
}
/* ===== END IM3 TILDA CORE FIXES ===== */

async function im3RepairFormulas() { try { im3ShowAlert("Checking and repairing dashboard formulas...","info"); const result=await im3Jsonp("repairformulas"); im3ShowAlert(result.repaired?"Dashboard formulas repaired.":"Formula check completed. No missing formulas found.","success"); await im3LoadDashboard(); } catch(err) { im3ShowAlert("Formula repair error: "+err,"error"); } }
async function im3ApplyFilters() {
  im3CollectFilters();
  await im3LoadModule(im3State.currentModule.id,document.getElementById("im3RowSelect").value||"");
  await im3LoadDashboard();
  await im3LoadSelectedSummary();
  if (im3State.chartBuilt) await im3BuildChart();
}
function im3AppendReportLink(result, label) {
  const box = document.getElementById("im3ReportLinks");
  if (!box || !result || !result.pdfUrl) return;
  const a = document.createElement("a");
  a.href = result.pdfUrl;
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = label || "Open generated report";
  box.appendChild(a);
}

async function im3GeneratePdf() {
  try {
    const projectId = im3SelectedAnalysisProjectId ? im3SelectedAnalysisProjectId() : "";
    im3ShowAlert("Generating executive PDF report in Google Drive...", "info");
    const result = await im3Jsonp("pdf", { filters: im3FilterParam(), projectId }, 60000);
    im3ShowAlert("Executive PDF generated. Use the report link below to open it.", "success");
    im3AppendReportLink(result, "Open Executive PDF Report");
  } catch(err) {
    im3ShowAlert("PDF generation error: " + err, "error");
  }
}

async function im3GenerateDetailedReport() {
  try {
    const projectId = im3SelectedAnalysisProjectId ? im3SelectedAnalysisProjectId() : "";
    im3ShowAlert("Generating detailed investment report in Google Drive...", "info");
    const result = await im3Jsonp("detailedreport", { filters: im3FilterParam(), projectId }, 90000);
    im3ShowAlert("Detailed investment report generated. Use the report link below to open it.", "success");
    im3AppendReportLink(result, "Open Detailed Investment Report");
  } catch(err) {
    im3ShowAlert("Detailed report error: " + err, "error");
  }
}
function im3ToggleTheme() { const app=document.getElementById("im3-app"); const isNight=app.getAttribute("data-theme")==="night"; app.setAttribute("data-theme", isNight?"day":"night"); document.getElementById("im3ThemeText").textContent=isNight?"Night mode":"Day mode"; document.getElementById("im3ThemeIcon").src=isNight?"https://img.icons8.com/fluency-systems-regular/48/moon-symbol.png":"https://img.icons8.com/fluency-systems-regular/48/sun.png"; }

document.getElementById("im3RefreshBtn").addEventListener("click",()=>im3LoadModule(im3State.currentModule.id,document.getElementById("im3RowSelect").value));
document.getElementById("im3SaveBtn").addEventListener("click",im3SaveCurrent);
document.getElementById("im3NextBtn").addEventListener("click",async()=>{const ok=await im3SaveCurrent(); if(ok) im3LoadModuleByIndex(im3State.moduleIndex+1);});
document.getElementById("im3BackBtn").addEventListener("click",()=>im3LoadModuleByIndex(im3State.moduleIndex-1));
document.getElementById("im3PdfBtn").addEventListener("click",im3GeneratePdf);
const im3DetailedBtn = document.getElementById("im3DetailedReportBtn");
if (im3DetailedBtn) im3DetailedBtn.addEventListener("click", im3GenerateDetailedReport);
document.getElementById("im3ApplyFiltersBtn").addEventListener("click",im3ApplyFilters);
document.getElementById("im3ClearFiltersBtn").addEventListener("click",im3ClearFilters);
document.getElementById("im3RepairBtn").addEventListener("click",im3RepairFormulas);
document.getElementById("im3BuildChartBtn").addEventListener("click",im3BuildChart);
document.getElementById("chartTemplate").addEventListener("change", e => im3ApplyGraphTemplate(e.target.value));
document.getElementById("im3ClearChartBtn").addEventListener("click", im3ClearActiveChart);
document.getElementById("im3SummaryRefreshBtn").addEventListener("click", im3LoadSelectedSummary);
document.getElementById("im3ThemeToggle").addEventListener("click",im3ToggleTheme);


/* ===== v2.5 project-level dashboard cards override ===== */
function im3ProjectOptions() {
  const f = im3State.filterOptions || im3State.metadata?.filters || {};
  const fromFilters = f.projectIds || [];
  const fromDropdowns = im3State.dropdowns?.__PROJECTS__ || [];
  const source = fromFilters.length ? fromFilters : fromDropdowns;
  return (source || []).map(im3NormalizeOption).filter(o => o.value);
}

function im3RenderAnalysisProjectSelect() {
  const sel = document.getElementById("im3AnalysisProjectSelect");
  if (!sel) return;
  const options = im3ProjectOptions();
  sel.innerHTML = options.length
    ? options.map((o, idx) => `<option value="${im3Esc(o.value)}">${im3Esc(o.label)}</option>`).join("")
    : `<option value="">No projects available</option>`;

  const currentFilter = im3MultiValues("filterProjects")[0] || "";
  if (currentFilter && options.some(o => String(o.value) === String(currentFilter))) {
    sel.value = currentFilter;
  } else if (options.length) {
    sel.value = options[0].value;
    im3SetMultiSelectValues("filterProjects", [sel.value]);
    im3CollectFilters();
  }

  sel.onchange = async () => {
    if (sel.value) {
      im3SetMultiSelectValues("filterProjects", [sel.value]);
      im3CollectFilters();
    }
    await im3LoadDashboard();
    await im3LoadSelectedSummary();
    if (im3State.chartBuilt) await im3BuildChart();
  };
}

function im3SelectedAnalysisProjectId() {
  const sel = document.getElementById("im3AnalysisProjectSelect");
  return sel && sel.value ? sel.value : (im3MultiValues("filterProjects")[0] || "");
}

function im3RenderFilters() {
  const f = im3State.filterOptions || im3State.metadata?.filters || {};
  const d = im3State.dropdowns || {};
  fillSearchableMulti("filterProjects", f.projectIds || d.__PROJECTS__ || []);
  fillSearchableMulti("filterAssumptions", f.assumptionSetIds || d.__ASSUMPTIONS__ || []);
  fillSearchableMulti("filterScenarios", f.scenarioIds || d.__RISK_SCENARIOS__ || []);
  fillSearchableMulti("filterYears", f.years || []);
  fillSearchableMulti("filterProjectTypes", f.projectTypes || d["00_Lookup_ProjectTypes"] || []);
  fillSearchableMulti("filterLocations", f.locations || d["00_Lookup_Locations"] || []);
  fillSearchableMulti("filterMetrics", im3State.metadata?.chartMetrics || []);
}

function im3FormatCardValue(value, format) {
  if (value === undefined || value === null || value === "") return "—";
  const n = im3NumberValue(value);
  if (isNaN(n)) return String(value);
  const fmt = String(format || "");
  if (fmt === "percent") return (Math.abs(n) <= 1 ? n * 100 : n).toFixed(2) + "%";
  if (fmt === "score") return Number(n.toFixed(2)).toLocaleString();
  if (fmt === "money" || /money|usd|npv|capex|opex|revenue|cost|value/i.test(fmt)) {
    if (Math.abs(n) >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
    if (Math.abs(n) >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
    return "$" + Number(n.toFixed(2)).toLocaleString();
  }
  if (fmt === "percent_or_score") {
    if (Math.abs(n) <= 1) return (n * 100).toFixed(2) + "%";
    return Number(n.toFixed(2)).toLocaleString();
  }
  return Number(n.toFixed(2)).toLocaleString();
}

function im3RenderSummaryCards(data) {
  const box = document.getElementById("im3SummaryCards");
  const source = document.getElementById("im3SummarySource");
  if (!box) return;
  const cards = data.cards || [];
  if (!cards.length) {
    box.innerHTML = `<div class="im3-readonly">No indicators available for this selection.</div>`;
    if (source) source.textContent = "";
    return;
  }
  box.innerHTML = cards.map(c => `
    <div class="im3-summary-kpi">
      <span>${im3Esc(c.label)}</span>
      <strong>${im3Esc(im3FormatCardValue(c.value, c.format))}</strong>
      <small>${im3Esc(c.source || "")}</small>
    </div>`).join("");
  if (source) source.textContent = `${data.sourceSheet || ""}${data.sourceRange ? " — " + data.sourceRange : ""}`;
}

async function im3LoadDashboard() {
  const projectId = im3SelectedAnalysisProjectId();
  const data = await im3Jsonp("dashboard", { filters: im3FilterParam(), projectId }, 35000);
  const summary = data.summary || data.kpis || {};
  const rows = data.rows || data.data || [];
  document.getElementById("dashRows").textContent = data.totalRowsAfterFilter || rows.length || summary.rows || summary.count || 0;
  document.getElementById("dashNpv").textContent = im3FormatKpi(summary.avgNPV ?? summary.avgNpv ?? summary.averageNPV);
  document.getElementById("dashIrr").textContent = im3FormatKpi(summary.avgIRR ?? summary.avgIrr ?? summary.averageIRR, true);
  document.getElementById("dashMcda").textContent = im3FormatKpi(summary.avgMCDA ?? summary.avgMcda);
  document.getElementById("dashSd").textContent = im3FormatKpi(summary.avgSD ?? summary.avgSystemDynamics);
  document.getElementById("dashIntegrated").textContent = im3FormatKpi(summary.avgIntegratedScore ?? summary.avgIntegrated);
  const best = summary.bestProject || summary.best_project || {};
  document.getElementById("dashBest").textContent = typeof best === "object" ? (best.Project_Name || best.Project_ID || "—") : (best || "—");
  document.getElementById("dashDecision").textContent = summary.decision || (rows[0]?.Final_Decision || rows[0]?.Decision_Label || "Review");
  document.getElementById("dashRisk").textContent = summary.risk || summary.riskLevel || rows[0]?.Scenario_Risk_Class || rows[0]?.Risk_Label || "Filtered output";
  const title = document.getElementById("dashProjectName");
  const meta = document.getElementById("dashProjectMeta");
  const selectedLabel = document.getElementById("im3AnalysisProjectSelect")?.selectedOptions?.[0]?.textContent || "";
  if (title) title.textContent = selectedLabel ? selectedLabel.replace(/^.*?—\s*/, "") : "Selected Analysis";
  if (meta) meta.textContent = projectId ? `Project-level IM³ results: ${projectId}` : "Filtered IM³ results";
}

async function im3LoadSelectedSummary() {
  const select = document.getElementById("im3SummarySelect");
  const meta = document.getElementById("im3SummaryMeta");
  const title = document.getElementById("im3SummaryTitle");
  if (!select) return;
  const viewId = select.value || im3State.summaryView || IM3_SUMMARY_VIEWS[0].id;
  im3State.summaryView = viewId;
  const view = IM3_SUMMARY_VIEWS.find(v => v.id === viewId) || IM3_SUMMARY_VIEWS[0];
  if (title) title.textContent = view.title;
  try {
    const projectId = im3SelectedAnalysisProjectId();
    const data = await im3Jsonp("summarydata", { view: viewId, filters: im3FilterParam(), projectId }, 35000);
    im3RenderSummaryCards(data);
    if (meta) meta.textContent = data.note || `${data.title || view.title}`;
  } catch (err) {
    if (meta) meta.textContent = "Could not load this dashboard view: " + err;
    im3RenderSummaryCards({cards:[]});
  }
}

function im3SetDashboardProjectFromCurrentRecord() {
  const projectId = im3GetCurrentProjectId();
  const sel = document.getElementById("im3AnalysisProjectSelect");
  if (projectId && sel && Array.from(sel.options).some(o => String(o.value) === String(projectId))) {
    sel.value = projectId;
    im3SetMultiSelectValues("filterProjects", [projectId]);
    im3CollectFilters();
  }
}
/* ===== end v2.5 project-level dashboard cards override ===== */


/* ===== v2.6 UI-only professional polish ===== */
function im3CleanVisualText(text) {
  return String(text ?? "")
    .replace(/\b[A-Za-z0-9_ ]+!\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?\b/g, "")
    .replace(/\b\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?\b/g, "")
    .replace(/\s+[—-]\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function im3ProfessionalKpiSubtitle(label, fallback) {
  const clean = im3PrettyLabel(label || "");
  if (/risk|class|decision|status/i.test(clean)) return "Decision signal";
  if (/npv|value|revenue|capex|opex|cost|usd/i.test(clean)) return "Financial indicator";
  if (/score|mcda|dynamic|integrated/i.test(clean)) return "Performance score";
  if (/probability|rate|irr|percent|utilization|uptime/i.test(clean)) return "Ratio indicator";
  if (/project|row|count|active|scored/i.test(clean)) return "Model output";
  return fallback || "Dashboard indicator";
}

function im3AttachImageFallbacks() {
  document.querySelectorAll("#im3-app img").forEach(img => {
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    if (!img.getAttribute("alt")) img.setAttribute("alt", "");
  });
}

document.addEventListener("error", function(e) {
  const img = e.target;
  if (img && img.tagName === "IMG" && img.closest("#im3-app")) {
    img.classList.add("im3-img-failed");
    const holder = img.parentElement;
    if (holder) holder.classList.add("im3-icon-fallback");
  }
}, true);

function im3RenderSummaryCards(data) {
  const box = document.getElementById("im3SummaryCards");
  const source = document.getElementById("im3SummarySource");
  if (!box) return;
  const cards = data.cards || [];
  if (!cards.length) {
    box.innerHTML = `<div class="im3-readonly">No indicators available for this selection.</div>`;
    if (source) source.textContent = "";
    return;
  }
  box.innerHTML = cards.map((c, idx) => `
    <div class="im3-summary-kpi" data-kpi-index="${idx}">
      <div class="im3-summary-kpi-head">
        <span>${im3Esc(c.label)}</span>
        <i aria-hidden="true"></i>
      </div>
      <strong>${im3Esc(im3FormatCardValue(c.value, c.format))}</strong>
      <small>${im3Esc(im3ProfessionalKpiSubtitle(c.label, "Dashboard indicator"))}</small>
    </div>`).join("");
  if (source) source.textContent = "";
}

async function im3LoadSelectedSummary() {
  const select = document.getElementById("im3SummarySelect");
  const meta = document.getElementById("im3SummaryMeta");
  const title = document.getElementById("im3SummaryTitle");
  if (!select) return;
  const viewId = select.value || im3State.summaryView || IM3_SUMMARY_VIEWS[0].id;
  im3State.summaryView = viewId;
  const view = IM3_SUMMARY_VIEWS.find(v => v.id === viewId) || IM3_SUMMARY_VIEWS[0];
  if (title) title.textContent = view.title;
  try {
    const projectId = im3SelectedAnalysisProjectId();
    const data = await im3Jsonp("summarydata", { view: viewId, filters: im3FilterParam(), projectId }, 35000);
    im3RenderSummaryCards(data);
    if (meta) {
      const cleanNote = im3CleanVisualText(data.note || data.title || view.title);
      meta.textContent = cleanNote || "Dashboard indicators updated for the selected project.";
    }
    im3AttachImageFallbacks();
  } catch (err) {
    if (meta) meta.textContent = "Could not load this dashboard view: " + err;
    im3RenderSummaryCards({cards:[]});
  }
}

const im3BaseRenderStepsV26 = im3RenderSteps;
im3RenderSteps = function() {
  im3BaseRenderStepsV26();
  im3AttachImageFallbacks();
};

const im3BaseRenderTemplateListV26 = im3RenderTemplateList;
im3RenderTemplateList = function() {
  im3BaseRenderTemplateListV26();
  im3AttachImageFallbacks();
};

const im3BaseLoadDashboardV26 = im3LoadDashboard;
im3LoadDashboard = async function() {
  await im3BaseLoadDashboardV26();
  im3AttachImageFallbacks();
};
/* ===== end v2.6 UI-only professional polish ===== */



/* ===== v2.7 Manual Input Mode — UI only layer ===== */
im3State.manualMode = false;
im3State.manualContext = {};
im3State.manualSourceProjectId = "";

function im3InstallManualPanel() {
  if (document.getElementById("im3ManualModePanel")) return;
  const hero = document.querySelector(".im3-hero");
  if (!hero || !hero.parentNode) return;
  const panel = document.createElement("section");
  panel.id = "im3ManualModePanel";
  panel.className = "im3-card im3-manual-panel";
  panel.innerHTML = `
    <div class="im3-card-header">
      <div>
        <p class="im3-section-label">Analysis mode</p>
        <h2>Data source and manual input</h2>
      </div>
      <p>Use existing Google Sheets data or create a new sequential analysis step by step.</p>
    </div>
    <div class="im3-manual-layout">
      <div class="im3-manual-mode-buttons">
        <button id="im3UseExistingModeBtn" class="im3-manual-choice active" type="button">
          <span>Use existing data</span><small>Read and visualize saved projects</small>
        </button>
        <button id="im3NewManualModeBtn" class="im3-manual-choice" type="button">
          <span>New manual analysis</span><small>Append new rows sequentially</small>
        </button>
      </div>
      <div class="im3-manual-autofill">
        <label class="im3-field"><span>Auto-fill from existing project</span><select id="im3ManualSourceProject" class="im3-select"></select></label>
        <label class="im3-field"><span>New project name</span><input id="im3ManualNewProjectName" type="text" placeholder="Optional name for copied project"></label>
        <button id="im3ManualCloneBtn" class="im3-btn soft" type="button">Auto-fill copy</button>
      </div>
    </div>
    <div id="im3ManualStatus" class="im3-manual-status">Current mode: existing data visualization.</div>
  `;
  hero.insertAdjacentElement("afterend", panel);
  document.getElementById("im3UseExistingModeBtn").addEventListener("click", im3ManualUseExistingMode);
  document.getElementById("im3NewManualModeBtn").addEventListener("click", im3ManualNewMode);
  document.getElementById("im3ManualCloneBtn").addEventListener("click", im3ManualCloneFromExisting);
  im3RenderManualSourceProjectOptions();
  im3ManualRefreshButtons();
}

function im3RenderManualSourceProjectOptions() {
  const sel = document.getElementById("im3ManualSourceProject");
  if (!sel) return;
  const options = im3ProjectOptions ? im3ProjectOptions() : ((im3State.filterOptions?.projectIds || []).map(im3NormalizeOption));
  sel.innerHTML = options.length ? options.map(o => `<option value="${im3Esc(o.value)}">${im3Esc(o.label)}</option>`).join("") : `<option value="">No project available</option>`;
}

function im3ManualUseExistingMode() {
  im3State.manualMode = false;
  im3ManualRefreshButtons();
  im3ShowAlert("Existing data mode activated. The app will read and visualize Google Sheets records.", "success");
}

async function im3ManualNewMode() {
  im3State.manualMode = true;
  im3State.manualContext = {};
  im3ManualRefreshButtons();
  im3ShowAlert("Manual input mode activated. Fill each step and use Save or Save & proceed to append new rows.", "info");
  await im3LoadModuleByIndex(0);
}

function im3ManualRefreshButtons() {
  const existing = document.getElementById("im3UseExistingModeBtn");
  const manual = document.getElementById("im3NewManualModeBtn");
  const status = document.getElementById("im3ManualStatus");
  const save = document.getElementById("im3SaveBtn");
  const next = document.getElementById("im3NextBtn");
  if (existing) existing.classList.toggle("active", !im3State.manualMode);
  if (manual) manual.classList.toggle("active", !!im3State.manualMode);
  if (status) status.textContent = im3State.manualMode
    ? "Current mode: manual input. New data will be inserted into the next free Google Sheets row with generated IDs."
    : "Current mode: existing data visualization.";
  if (save) save.textContent = im3State.manualMode ? "Save new row" : "Save";
  if (next) next.textContent = im3State.manualMode ? "Save new row & proceed" : "Save & proceed";
}

function im3ManualCollectPayload() {
  const form = document.getElementById("im3Form");
  const payload = {};
  if (!form) return payload;
  Array.from(new FormData(form).entries()).forEach(([k, v]) => payload[k] = v);
  return payload;
}

async function im3ManualAppendCurrentStep() {
  if (!im3State.currentModule) return false;
  try {
    const payload = im3ManualCollectPayload();
    const result = await im3Jsonp("appendstep", {
      moduleId: im3State.currentModule.id,
      payload: im3Encode(payload),
      context: im3Encode(im3State.manualContext || {})
    }, 45000);

    im3State.manualContext = result.context || im3State.manualContext || {};
    im3ShowAlert(`New row saved in ${result.sheetName}: ${result.keyValue}`, "success");

    if (result.projectId) {
      im3ManualEnsureProjectOption(result.projectId, payload.Project_Name || result.projectId);
      const analysisSelect = document.getElementById("im3AnalysisProjectSelect");
      if (analysisSelect) analysisSelect.value = result.projectId;
      im3SetMultiSelectValues("filterProjects", [result.projectId]);
      im3CollectFilters();
    }

    await im3LoadModule(im3State.currentModule.id, result.keyValue || "");
    await im3RefreshOutputsOnly();
    return true;
  } catch (err) {
    im3ShowAlert("Manual append error: " + err, "error");
    return false;
  }
}

function im3ManualEnsureProjectOption(projectId, label) {
  if (!projectId) return;
  ["im3AnalysisProjectSelect", "im3ManualSourceProject"].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    if (!Array.from(sel.options).some(o => String(o.value) === String(projectId))) {
      const opt = document.createElement("option");
      opt.value = projectId;
      opt.textContent = im3CleanOptionLabel(label || projectId);
      sel.appendChild(opt);
    }
  });
}

async function im3ManualCloneFromExisting() {
  const sourceSel = document.getElementById("im3ManualSourceProject");
  const nameInput = document.getElementById("im3ManualNewProjectName");
  const sourceProjectId = sourceSel ? sourceSel.value : "";
  const newProjectName = nameInput ? nameInput.value.trim() : "";
  if (!sourceProjectId) {
    im3ShowAlert("Select a source project before using auto-fill.", "error");
    return;
  }
  try {
    im3State.manualMode = true;
    im3ManualRefreshButtons();
    im3ShowAlert("Creating auto-filled manual copy in Google Sheets...", "info");
    const result = await im3Jsonp("cloneproject", { sourceProjectId, newProjectName }, 90000);
    im3State.manualContext = result.context || {};
    if (result.newProjectId) {
      im3ManualEnsureProjectOption(result.newProjectId, newProjectName || result.newProjectId);
      const analysisSelect = document.getElementById("im3AnalysisProjectSelect");
      if (analysisSelect) analysisSelect.value = result.newProjectId;
      im3SetMultiSelectValues("filterProjects", [result.newProjectId]);
      im3CollectFilters();
    }
    im3ShowAlert(`Auto-fill completed. ${result.createdRows || 0} rows were created.`, "success");
    await im3LoadModuleByIndex(0);
    await im3RefreshOutputsOnly();
  } catch (err) {
    im3ShowAlert("Auto-fill error: " + err, "error");
  }
}

const im3BaseSaveCurrentV27 = im3SaveCurrent;
im3SaveCurrent = async function() {
  if (im3State.manualMode) return im3ManualAppendCurrentStep();
  return im3BaseSaveCurrentV27();
};

const im3BaseInitV27 = im3Init;
im3Init = async function() {
  await im3BaseInitV27();
  im3InstallManualPanel();
  im3RenderManualSourceProjectOptions();
  im3ManualRefreshButtons();
};

const im3BaseRenderAnalysisProjectSelectV27 = typeof im3RenderAnalysisProjectSelect === "function" ? im3RenderAnalysisProjectSelect : null;
if (im3BaseRenderAnalysisProjectSelectV27) {
  im3RenderAnalysisProjectSelect = function() {
    im3BaseRenderAnalysisProjectSelectV27();
    im3RenderManualSourceProjectOptions();
  };
}
/* ===== end v2.7 Manual Input Mode ===== */


im3Init();

/* ============================================================
 * IM³ Framework MVP — Graph Studio v2.0 frontend layer
 * Add this block at the END of im3-app.js.
 * ============================================================ */

function im3MetricCatalogV20() {
  return im3State?.metadata?.chartMetricCatalog || im3State?.metadata?.chartMetrics || [];
}

function im3MetricGroupsV20() {
  const catalog = im3MetricCatalogV20();
  const groups = {};
  catalog.forEach(m => {
    const group = m.group || "Other";
    if (!groups[group]) groups[group] = [];
    groups[group].push(m);
  });
  return groups;
}

function im3MetricByIdV20(id) {
  return im3MetricCatalogV20().find(m => (m.metricId || m.value) === id || m.valueField === id);
}

function im3RenderChartControls() {
  const templateSelect = document.getElementById("chartTemplate");
  const groupSelect = document.getElementById("chartMetricGroup");
  const metricBox = document.getElementById("chartMetricsMulti");
  const displaySelect = document.getElementById("chartDisplayType");
  if (!templateSelect || !groupSelect || !metricBox) return im3RenderChartControlsLegacyV20();

  const templates = im3State.metadata.graphTemplates || IM3_GRAPH_TEMPLATES || [];
  templateSelect.innerHTML = templates.map(t => `<option value="${im3Esc(t.id)}">${im3Esc(t.title)}</option>`).join("");

  const groups = Object.keys(im3MetricGroupsV20());
  groupSelect.innerHTML = groups.map(g => `<option value="${im3Esc(g)}">${im3Esc(g)}</option>`).join("");

  if (displaySelect) {
    displaySelect.innerHTML = `<option value="auto">Automatic</option><option value="line">Line</option><option value="bar">Bar</option>`;
  }

  im3RenderTemplateListV20(templates);
  const first = templates[0] || { id:"financial_dcf", metricGroup:"Financial USD", defaultMetrics:["Revenue_USD"] };
  im3ApplyGraphTemplate(first.id);
}

function im3RenderChartControlsLegacyV20() {
  const old = document.getElementById("chartMetric");
  if (!old) return;
  old.innerHTML = im3MetricCatalogV20().map(m => `<option value="${im3Esc(m.metricId || m.value)}">${im3Esc(m.label || m.metricId || m.value)}</option>`).join("");
}

function im3RenderTemplateListV20(templates) {
  const box = document.getElementById("im3GraphTemplateList");
  if (!box) return;
  box.innerHTML = (templates || []).map(t => `
    <button class="im3-graph-template" type="button" data-template="${im3Esc(t.id)}">
      <span><strong>${im3Esc(t.title)}</strong><small>${im3Esc(t.metricGroup || t.category || "Graph")}</small></span>
    </button>
  `).join("");
  box.querySelectorAll(".im3-graph-template").forEach(btn => btn.addEventListener("click", () => im3ApplyGraphTemplate(btn.dataset.template)));
}

function im3ApplyGraphTemplate(templateId) {
  const templates = im3State.metadata.graphTemplates || [];
  const template = templates.find(t => t.id === templateId) || templates[0] || {};
  const templateSelect = document.getElementById("chartTemplate");
  const groupSelect = document.getElementById("chartMetricGroup");
  const display = document.getElementById("chartDisplayType");
  if (templateSelect) templateSelect.value = template.id || templateId;
  if (groupSelect && template.metricGroup) groupSelect.value = template.metricGroup;
  if (display) display.value = "auto";

  im3RenderMetricCheckboxesV20(template.defaultMetrics || []);
  const hint = document.getElementById("im3GraphHint");
  if (hint) hint.textContent = `Select one or more compatible metrics from ${template.metricGroup || groupSelect?.value || "the selected group"}. X-axis: Year. Y-axis unit is applied automatically.`;
  document.querySelectorAll(".im3-graph-template").forEach(btn => btn.classList.toggle("active", btn.dataset.template === (template.id || templateId)));
}

function im3RenderMetricCheckboxesV20(defaultMetrics=[]) {
  const group = document.getElementById("chartMetricGroup")?.value || Object.keys(im3MetricGroupsV20())[0];
  const box = document.getElementById("chartMetricsMulti");
  if (!box) return;
  const metrics = im3MetricGroupsV20()[group] || [];
  const defaults = new Set(defaultMetrics.length ? defaultMetrics : [metrics[0]?.metricId || metrics[0]?.value].filter(Boolean));
  box.innerHTML = metrics.map(m => {
    const id = m.metricId || m.value;
    const unit = m.fallbackUnit || m.unit || "value";
    return `<label class="im3-metric-option" title="${im3Esc(m.sheetName || "")} → ${im3Esc(m.valueField || id)}">
      <input type="checkbox" value="${im3Esc(id)}" ${defaults.has(id) ? "checked" : ""}>
      <span></span>
      <strong>${im3Esc(m.label || id)}</strong>
      <em>${im3Esc(unit)}</em>
    </label>`;
  }).join("");
  box.querySelectorAll('input[type="checkbox"]').forEach(i => i.addEventListener("change", im3ValidateMetricSelectionV20));
  im3ValidateMetricSelectionV20();
}

function im3SelectedMetricIdsV20() {
  return Array.from(document.querySelectorAll('#chartMetricsMulti input[type="checkbox"]:checked')).map(i => i.value);
}

function im3ValidateMetricSelectionV20() {
  const selected = im3SelectedMetricIdsV20().map(im3MetricByIdV20).filter(Boolean);
  const btn = document.getElementById("im3BuildChartBtn");
  const unitEl = document.getElementById("chartUnitHint");
  if (!selected.length) {
    if (btn) btn.disabled = true;
    if (unitEl) unitEl.textContent = "Select at least one metric.";
    return false;
  }
  const compare = selected[0].allowedCompareGroup;
  const incompatible = selected.some(m => m.allowedCompareGroup !== compare);
  if (btn) btn.disabled = incompatible;
  const unit = selected[0].fallbackUnit || selected[0].unit || "value";
  if (unitEl) unitEl.textContent = incompatible ? "Incompatible units. Select metrics from the same unit group." : `Y-axis unit: ${unit}`;
  return !incompatible;
}

document.addEventListener("change", e => {
  if (e.target && e.target.id === "chartMetricGroup") im3RenderMetricCheckboxesV20([]);
  if (e.target && e.target.id === "chartTemplate") im3ApplyGraphTemplate(e.target.value);
});

async function im3BuildChart() {
  try {
    if (!im3ValidateMetricSelectionV20()) {
      im3ShowAlert("Select compatible metrics before rendering the graph.", "error");
      return;
    }
    const metrics = im3SelectedMetricIdsV20();
    const template = (im3State.metadata.graphTemplates || []).find(t => t.id === document.getElementById("chartTemplate")?.value) || {};
    const displayType = document.getElementById("chartDisplayType")?.value || "auto";
    const chartType = displayType === "auto" ? (template.defaultChart || "line") : displayType;

    document.getElementById("advancedChartTitle").textContent = `${template.title || "Time Series"} — ${metrics.map(id => im3MetricByIdV20(id)?.label || id).join(", ")}`;
    const data = await im3Jsonp("timeseries", { filters: im3FilterParam(), metrics: im3Encode(metrics), groupBy:"Project_Name" }, 45000);
    if (!data.series || !data.series.some(s => s.data && s.data.length)) {
      im3ShowAlert("No data found for selected metrics and filters.", "info");
      im3ClearActiveChart();
      return;
    }
    im3State.chartBuilt = true;
    im3RenderTimeSeriesV20(data, chartType);
  } catch (err) {
    im3ShowAlert("Chart error: " + err, "error");
    console.error(err);
  }
}

function im3RenderTimeSeriesV20(data, chartType) {
  const years = data.years || [...new Set(data.series.flatMap(s => (s.data || []).map(p => String(p.year))))].sort();
  const colors = im3ChartColors ? im3ChartColors() : ["#193A64", "#2B4970", "#F9DA7B", "#536C8F", "#8DA0BA"];
  const datasets = [];
  data.series.forEach((s, sidx) => {
    const seriesNames = [...new Set((s.data || []).map(p => p.series || s.label))];
    seriesNames.forEach((name, idx) => {
      datasets.push({
        label: seriesNames.length > 1 ? `${s.label} — ${im3CleanOptionLabel(name)}` : s.label,
        data: years.map(y => {
          const p = (s.data || []).find(d => String(d.year) === String(y) && String(d.series || s.label) === String(name));
          return p ? p.value : null;
        }),
        borderWidth: 2.4,
        tension: .25,
        fill: false,
        borderColor: colors[(sidx + idx) % colors.length],
        backgroundColor: colors[(sidx + idx) % colors.length],
        borderRadius: chartType === "bar" ? 6 : 0
      });
    });
  });

  im3DestroyActiveChart();
  im3State.charts.advanced = new Chart(document.getElementById("im3AdvancedChart"), {
    type: chartType === "bar" ? "bar" : "line",
    data: { labels: years, datasets },
    options: {
      responsive:true,
      maintainAspectRatio:false,
      plugins:{ legend:{ position:"bottom" }, tooltip:{ mode:"nearest", intersect:false } },
      scales:{
        x:{ title:{ display:true, text:"Year" }, grid:{ display:false } },
        y:{ title:{ display:true, text:data.yUnit || "value" }, grid:{ color:"rgba(25,58,100,.10)" } }
      }
    }
  });
}

async function im3ValidateCurrent() {
  try {
    const form = document.getElementById("im3Form");
    if (!form || !im3State.currentModule) return;
    const payload = {};
    Array.from(new FormData(form).entries()).forEach(([k,v]) => payload[k] = v);
    const result = await im3Jsonp("validatemodel", { moduleId:im3State.currentModule.id, payload:im3Encode(payload) }, 35000);
    if (result.valid) im3ShowAlert(result.warnings?.length ? "Validation passed with warnings: " + result.warnings.join(" | ") : "Validation passed. Inputs are safe to save.", "success");
    else im3ShowAlert("Validation failed: " + result.errors.join(" | "), "error");
  } catch (err) {
    im3ShowAlert("Validation error: " + err, "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const validateBtn = document.getElementById("im3ValidateBtn");
  if (validateBtn) validateBtn.addEventListener("click", im3ValidateCurrent);
});

/* ============================================================
 * IM³ Framework MVP — Summary Dashboard Frontend Repair v2.8
 * Purpose:
 * - Makes im3-summary-card independent from the obsolete im3DashboardTable ID.
 * - Uses action=summarydata and renders cards into im3SummaryCards.
 * - Adds graceful fallback using dashboard KPIs if summarydata is unavailable.
 * - Rebinds the Refresh result button after earlier function overrides.
 * ============================================================ */

function im3SummaryFallbackCardsV28(summary, rows) {
  const first = (rows || [])[0] || {};
  return {
    title: "Dashboard summary fallback",
    note: "Summary endpoint was not available, so dashboard KPIs are shown instead.",
    cards: [
      { label:"Rows", value:(rows || []).length || summary.count || summary.rows || 0, format:"plain" },
      { label:"Average NPV", value:summary.avgNPV ?? summary.avgNpv ?? first.NPV_USD, format:"money" },
      { label:"Average IRR", value:summary.avgIRR ?? summary.avgIrr ?? first.IRR, format:"percent" },
      { label:"MCDA Score", value:summary.avgMCDA ?? summary.avgMcda ?? first.MCDA_Score, format:"score" },
      { label:"System Dynamics Score", value:summary.avgSD ?? summary.avgSystemDynamics ?? first.System_Dynamics_Score, format:"score" },
      { label:"Integrated Score", value:summary.avgIntegratedScore ?? summary.avgIntegrated ?? first.Integrated_Score, format:"score" },
      { label:"Decision", value:summary.decision || first.Final_Decision || first.Decision_Label || "Review", format:"plain" },
      { label:"Risk", value:summary.risk || summary.riskLevel || first.Scenario_Risk_Class || first.Risk_Label || "Filtered output", format:"plain" }
    ]
  };
}

function im3NormalizeSummaryCardsV28(data) {
  const cards = Array.isArray(data?.cards) ? data.cards : [];
  return cards.map(c => ({
    label: c.label || c.name || c.metric || "Indicator",
    value: c.value,
    format: c.format || "plain",
    source: c.source || ""
  })).filter(c => c.label);
}

function im3RenderSummaryCards(data) {
  const box = document.getElementById("im3SummaryCards");
  const source = document.getElementById("im3SummarySource");
  if (!box) return;
  const cards = im3NormalizeSummaryCardsV28(data);
  if (!cards.length) {
    box.innerHTML = `<div class="im3-readonly">No indicators available for this selection. Check whether the selected project has data in the chosen module.</div>`;
    if (source) source.textContent = "";
    return;
  }
  box.innerHTML = cards.map((c, idx) => `
    <div class="im3-summary-kpi" data-kpi-index="${idx}">
      <div class="im3-summary-kpi-head">
        <span>${im3Esc(c.label)}</span>
        <i aria-hidden="true"></i>
      </div>
      <strong>${im3Esc(im3FormatCardValue(c.value, c.format))}</strong>
      <small>${im3Esc(im3ProfessionalKpiSubtitle ? im3ProfessionalKpiSubtitle(c.label, "Dashboard indicator") : (c.source || "Dashboard indicator"))}</small>
    </div>`).join("");
  if (source) {
    const sourceText = [data?.sourceSheet, data?.sourceRange].filter(Boolean).join(" — ");
    source.textContent = im3CleanVisualText ? im3CleanVisualText(sourceText) : sourceText;
  }
}

async function im3LoadSelectedSummary() {
  const select = document.getElementById("im3SummarySelect");
  const meta = document.getElementById("im3SummaryMeta");
  const title = document.getElementById("im3SummaryTitle");
  const box = document.getElementById("im3SummaryCards");
  if (!select || !box) return;

  const viewId = select.value || im3State.summaryView || (IM3_SUMMARY_VIEWS[0] && IM3_SUMMARY_VIEWS[0].id) || "production_summary";
  im3State.summaryView = viewId;
  const view = IM3_SUMMARY_VIEWS.find(v => v.id === viewId) || { id:viewId, title:im3PrettyLabel(viewId) };
  if (title) title.textContent = view.title;
  if (meta) meta.textContent = "Loading selected dashboard indicators...";

  try {
    const projectId = im3SelectedAnalysisProjectId ? im3SelectedAnalysisProjectId() : "";
    const data = await im3Jsonp("summarydata", { view:viewId, filters:im3FilterParam(), projectId }, 45000);
    im3RenderSummaryCards(data);
    if (meta) {
      const cleanNote = im3CleanVisualText ? im3CleanVisualText(data.note || data.message || data.title || view.title) : (data.note || data.message || data.title || view.title);
      meta.textContent = cleanNote || "Dashboard indicators updated for the selected project.";
    }
    if (typeof im3AttachImageFallbacks === "function") im3AttachImageFallbacks();
  } catch (err) {
    try {
      const projectId = im3SelectedAnalysisProjectId ? im3SelectedAnalysisProjectId() : "";
      const dash = await im3Jsonp("dashboard", { filters:im3FilterParam(), projectId }, 35000);
      const fallback = im3SummaryFallbackCardsV28(dash.summary || {}, dash.rows || []);
      im3RenderSummaryCards(fallback);
      if (meta) meta.textContent = "Summary endpoint unavailable; showing dashboard KPI fallback. API detail: " + err;
    } catch (dashErr) {
      im3RenderSummaryCards({ cards:[] });
      if (meta) meta.textContent = "Could not load summary dashboard data: " + err;
    }
  }
}

function im3RebindSummaryRefreshV28() {
  const btn = document.getElementById("im3SummaryRefreshBtn");
  if (!btn || btn.dataset.summaryRepairBound === "1") return;
  const clone = btn.cloneNode(true);
  clone.dataset.summaryRepairBound = "1";
  btn.parentNode.replaceChild(clone, btn);
  clone.addEventListener("click", im3LoadSelectedSummary);
}

document.addEventListener("DOMContentLoaded", () => {
  im3RebindSummaryRefreshV28();
});
setTimeout(im3RebindSummaryRefreshV28, 1200);
/* ===== end Summary Dashboard Frontend Repair v2.8 ===== */