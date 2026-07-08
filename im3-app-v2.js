if (window.Chart) {
  Chart.defaults.font.family = "'PT Sans', Arial, sans-serif";
  Chart.defaults.color = "#193A64";
  Chart.defaults.plugins.tooltip.enabled = true;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
}

const IM3_API_URL = "https://script.google.com/macros/s/AKfycbzYPTHufhToOZlingFhF5acagEnRIg63Dv3a0AAFsUspsAIUHpKoCfSFbq5LLssfUlD/exec";

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

const im3State = { metadata:null, modules:[], moduleIndex:0, currentModule:null, currentRows:[], currentSelected:null, currentHeaders:[], dropdowns:{}, filterOptions:{}, filters:{}, charts:{}, chartBuilt:false, summaryView:"production_summary", saving:false };


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

function im3MergeDropdownMaps(...maps) {
  const merged = {};
  maps.forEach(map => {
    if (!map || typeof map !== "object") return;
    Object.keys(map).forEach(key => {
      const value = map[key];
      if (Array.isArray(value)) merged[key] = value;
    });
  });
  return merged;
}

function im3DropdownsFromFilterOptions(filters={}) {
  return {
    __PROJECTS__: filters.projectIds || [],
    __ASSUMPTIONS__: filters.assumptionSetIds || [],
    __RISK_SCENARIOS__: filters.scenarioIds || [],
    "00_Lookup_ProjectTypes": filters.projectTypes || [],
    "00_Lookup_Locations": filters.locations || [],
    "00_Lookup_ProjectPhases": filters.phases || [],
    "00_Lookup_ProductStreams": filters.productStreams || [],
    "00_Lookup_CostTypes": filters.costTypes || [],
    "00_Lookup_ROV_OptionTypes": filters.optionTypes || [],
    "00_Lookup_RiskLevels": filters.riskLevels || []
  };
}

function im3NormalizeDropdownPayload(payload, metadataDropdowns={}, filters={}) {
  return im3MergeDropdownMaps(
    metadataDropdowns,
    payload,
    im3DropdownsFromFilterOptions(payload || {}),
    im3DropdownsFromFilterOptions(filters || {})
  );
}

function im3SafeDomId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "_");
}

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
    const dropdownsPromise = im3Jsonp("dropdowns", { scope:"all" }, 35000)
      .catch(() => im3Jsonp("configoptions", {}, 35000))
      .catch(() => im3State.metadata.dropdowns || {});
    const loaded = await Promise.all([filtersPromise, dropdownsPromise]);
    im3State.filterOptions = loaded[0] || {};
    im3State.dropdowns = im3NormalizeDropdownPayload(loaded[1] || {}, im3State.metadata.dropdowns || {}, im3State.filterOptions);
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
  im3State.currentHeaders = data.headers || data.fields || Object.keys(selected);

  document.getElementById("im3ModuleTitle").textContent = im3ModuleLabel(moduleMeta);
  document.getElementById("im3ModuleDescription").textContent = moduleMeta.description || `Loaded ${rows.length} row(s) from Google Sheets.`;
  im3RenderRowSelect(rows, selected, moduleMeta);
  im3RenderForm(moduleMeta, selected, im3State.currentHeaders);
  im3RenderTable("im3Table", rows, 100);
  im3SetProgress(im3State.moduleIndex);
}

function im3RenderRowSelect(rows, selected, moduleMeta={}) {
  const sel = document.getElementById("im3RowSelect");
  if (!sel) return;
  const keyColumn = moduleMeta.keyColumn || "";
  const currentId = selected[keyColumn] || selected.Row_ID || selected.ID || selected.Project_ID || selected.id || "";
  const createOption = moduleMeta.readOnly ? "" : `<option value="__new__">${im3Esc("Create new record")}</option>`;
  sel.innerHTML = createOption + (rows || []).map((r, idx) => {
    const id = r[keyColumn] || r.Row_ID || r.ID || r.Project_ID || r.id || String(idx + 1);
    const label = r.Project_Name || r.Name || r.Scenario_Name || r.Parameter_Name || r.Parameter || r[keyColumn] || id;
    return `<option value="${im3Esc(id)}" ${String(id) === String(currentId) ? "selected" : ""}>${im3Esc(im3CleanOptionLabel(label))}</option>`;
  }).join("");
  sel.onchange = async () => {
    if (sel.value === "__new__") {
      im3State.currentSelected = {};
      im3RenderForm(im3State.currentModule, {}, im3State.currentHeaders || []);
      im3SetManualStatus("validation", "New manual record ready. Fill required editable fields before saving.", "info");
      return;
    }
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
  return !im3IsEditableField(moduleMeta, key) || im3IsCalculatedField(key, value);
}

function im3IsEditableField(moduleMeta, key) {
  if (!moduleMeta || moduleMeta.readOnly) return false;
  if (!key || key === moduleMeta.keyColumn || key === "__rowNumber" || key === "Row_ID" || key === "ID") return false;
  const editable = new Set(moduleMeta.editableFields || []);
  return editable.has(key);
}

function im3IsCalculatedField(key, value) {
  if (typeof value === "string" && value.trim().startsWith("=")) return true;
  return /(^__|^calculated_|^output_|^result_|^display_|^recommendation_|^decision_label$|^risk_label$)/i.test(String(key || ""));
}

function im3IsFourDigitYearField(key) {
  return /^(Year|Base_Year|Start_Year|End_Year|Exercise_Year)$/i.test(String(key || ""));
}

function im3IsTextField(key) {
  return /(^|_)(ID|Name|Type|Phase|Location|Basin|Objective|Operator|Ownership|Currency|Status|Description|Notes|Unit|Stream|Source|Category|Frequency|Treatment|Area|Method|Trigger|Variable|Distribution|Group|Link|Formula|Module|Flag|Owner|Active|Editable|Scale)$/i.test(String(key || ""));
}

function im3IsNumericField(key) {
  const name = String(key || "");
  if (!name || im3IsTextField(name)) return false;
  if (im3IsFourDigitYearField(name)) return true;
  if (/^(Forecast_Horizon|Delay_Years|Payback_Years|Time_to_Exercise)$/i.test(name)) return true;
  return /(^|_)(Rate|Factor|Probability|Utilization|Uptime|Multiplier|Score|Amount|Quantity|Cost|Price|USD|CAPEX|OPEX|NPV|IRR|DNPV|Revenue|Tax|Production|Volume|Capacity|Reserve|Weight|Min|Max|Shock|Volatility|Rank|Index|Years?)($|_)/i.test(name) || /%/.test(name);
}

function im3NumberInputType(key) {
  return im3IsNumericField(key) ? "number" : "text";
}

function im3IsRequiredField(moduleMeta, key) {
  const id = String(moduleMeta?.id || "");
  if (id === "projects" && key === "Project_Name") return true;
  if (["assumptions","production","prices","capex_opex","mcda_scores"].includes(id) && key === "Project_ID") return true;
  if (["production","prices","capex_opex","risk_scenarios","map_dnpv","rov","mcda_scores","system_dynamics","sd_parameters","sensitivity","monte_carlo"].includes(id) && key === "Assumption_Set_ID") return true;
  if ((moduleMeta?.editableFields || []).includes("Year") && key === "Year") return true;
  return false;
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

function im3DropdownSource(moduleMeta, key) {
  return (moduleMeta.dropdowns || {})[key] || "";
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
    const required = im3IsRequiredField(moduleMeta, key);
    const requiredMark = required ? ` <em class="im3-required-mark">*</em>` : "";
    if (readonly) return `<label class="im3-field im3-readonly-calculated"><span>${label}</span><input name="${im3Esc(key)}" value="${im3Esc(value)}" readonly data-calculated="true"></label>`;
    const opts = im3DropdownOptions(moduleMeta, key, value);
    if (opts.length || im3DropdownSource(moduleMeta, key)) {
      const listId = "im3List_" + im3SafeDomId(moduleMeta.id || "module") + "_" + im3SafeDomId(key);
      const source = im3DropdownSource(moduleMeta, key);
      return `<label class="im3-field im3-editable-input im3-dropdown-input ${required ? "im3-required-field" : ""}"><span>${label}${requiredMark}</span><input name="${im3Esc(key)}" list="${im3Esc(listId)}" value="${im3Esc(value)}" data-dropdown-field="true" data-dropdown-source="${im3Esc(source)}" autocomplete="off" ${required ? "required" : ""}><datalist id="${im3Esc(listId)}">${opts.map(o => `<option value="${im3Esc(o.value)}" label="${im3Esc(o.label)}"></option>`).join("")}</datalist></label>`;
    }
    const type = im3NumberInputType(key);
    return `<label class="im3-field im3-editable-input ${required ? "im3-required-field" : ""}"><span>${label}${requiredMark}</span><input name="${im3Esc(key)}" type="${type}" step="any" value="${im3Esc(value)}" ${required ? "required" : ""}></label>`;
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
let im3ReportProgressTimer = null;

function im3ReportProgressElements() {
  return {
    box: document.getElementById("im3ReportProgress"),
    title: document.getElementById("im3ReportProgressTitle"),
    percent: document.getElementById("im3ReportProgressPercent"),
    fill: document.getElementById("im3ReportProgressFill"),
    status: document.getElementById("im3ReportProgressStatus"),
    time: document.getElementById("im3ReportProgressTime")
  };
}

function im3SetReportButtonsBusy(isBusy) {
  ["im3PdfBtn", "im3DetailedReportBtn", "im3InvestmentPackBtn", "im3ClearReportsBtn"].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = !!isBusy;
  });
}

function im3StartReportProgress(typeLabel, estimateSeconds) {
  const el = im3ReportProgressElements();
  const started = Date.now();
  const estimate = Math.max(20, Number(estimateSeconds) || 60);
  if (im3ReportProgressTimer) clearInterval(im3ReportProgressTimer);
  if (el.box) el.box.classList.remove("hidden");
  if (el.title) el.title.textContent = typeLabel || "Report generation";
  im3SetReportButtonsBusy(true);

  const update = () => {
    const elapsed = Math.max(0, Math.round((Date.now() - started) / 1000));
    const ratio = Math.min(0.92, elapsed / estimate);
    const pct = Math.max(8, Math.round(ratio * 100));
    if (el.percent) el.percent.textContent = pct + "%";
    if (el.fill) el.fill.style.width = pct + "%";
    if (el.status) {
      if (elapsed < 4) el.status.textContent = "Preparing report data...";
      else if (elapsed < Math.round(estimate * 0.45)) el.status.textContent = "Building PDF sections and tables...";
      else if (elapsed < Math.round(estimate * 0.75)) el.status.textContent = "Rendering document in Google Drive...";
      else el.status.textContent = "Finalizing file and link...";
    }
    if (el.time) {
      const remaining = Math.max(0, estimate - elapsed);
      el.time.textContent = "Elapsed: " + elapsed + "s | Typical estimate: ~" + estimate + "s | Remaining approx.: " + remaining + "s";
    }
  };
  update();
  im3ReportProgressTimer = setInterval(update, 1000);
}

function im3FinishReportProgress(message) {
  const el = im3ReportProgressElements();
  if (im3ReportProgressTimer) clearInterval(im3ReportProgressTimer);
  im3ReportProgressTimer = null;
  if (el.percent) el.percent.textContent = "100%";
  if (el.fill) el.fill.style.width = "100%";
  if (el.status) el.status.textContent = message || "Report generated successfully.";
  if (el.time) el.time.textContent = "Completed.";
  im3SetReportButtonsBusy(false);
}

function im3FailReportProgress(message) {
  const el = im3ReportProgressElements();
  if (im3ReportProgressTimer) clearInterval(im3ReportProgressTimer);
  im3ReportProgressTimer = null;
  if (el.percent) el.percent.textContent = "Error";
  if (el.fill) el.fill.style.width = "100%";
  if (el.status) el.status.textContent = message || "Report generation failed.";
  if (el.time) el.time.textContent = "Check Apps Script deployment, permissions or execution logs.";
  im3SetReportButtonsBusy(false);
}

function im3ClearGeneratedReports() {
  const box = document.getElementById("im3ReportLinks");
  if (box) box.innerHTML = "";
  const el = im3ReportProgressElements();
  if (im3ReportProgressTimer) clearInterval(im3ReportProgressTimer);
  im3ReportProgressTimer = null;
  if (el.box) el.box.classList.add("hidden");
  if (el.percent) el.percent.textContent = "0%";
  if (el.fill) el.fill.style.width = "0%";
  if (el.status) el.status.textContent = "Waiting...";
  if (el.time) el.time.textContent = "Elapsed: 0s";
  im3SetReportButtonsBusy(false);
  im3ShowAlert("Generated report links cleared. You can generate a fresh version now.", "info");
}

function im3AppendReportLink(result, label) {
  const box = document.getElementById("im3ReportLinks");
  if (!box || !result) return;
  if (Array.isArray(result.files) && result.files.length) {
    const group = document.createElement("div");
    group.className = "im3-report-link-group";
    const title = document.createElement("strong");
    title.textContent = label || "Investment Decision Pack";
    group.appendChild(title);
    result.files.forEach(file => {
      if (!file || !file.pdfUrl) return;
      const a = document.createElement("a");
      a.href = file.pdfUrl;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = (file.reportType ? im3PrettyLabel(file.reportType) + " — " : "") + (file.projectName || "Open report");
      group.appendChild(a);
    });
    box.appendChild(group);
    return;
  }
  if (!result.pdfUrl) return;
  const a = document.createElement("a");
  a.href = result.pdfUrl;
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = label || "Open generated report";
  box.appendChild(a);
}

function im3SelectedReportLanguage() {
  const el = document.getElementById("im3ReportLanguage");
  return el ? (el.value || "en") : "en";
}

function im3ReportLanguageLabel(code) {
  const labels = { en:"English", pt:"Português", ru:"Русский", fr:"Français", es:"Español" };
  return labels[code] || labels.en;
}

async function im3GeneratePdf() {
  try {
    const projectId = im3SelectedAnalysisProjectId ? im3SelectedAnalysisProjectId() : "";
    const language = im3SelectedReportLanguage();
    im3StartReportProgress("Executive PDF report — " + im3ReportLanguageLabel(language), 45);
    im3ShowAlert("Generating executive PDF report (" + im3ReportLanguageLabel(language) + ") in Google Drive...", "info");
    const result = await im3Jsonp("pdf", { filters: im3FilterParam(), projectId, language }, 90000);
    im3FinishReportProgress("Executive PDF generated successfully.");
    im3ShowAlert("Executive PDF generated. Use the report link below to open it.", "success");
    im3AppendReportLink(result, "Open Executive PDF Report — " + im3ReportLanguageLabel(language));
  } catch(err) {
    im3FailReportProgress("Executive PDF generation failed: " + err);
    im3ShowAlert("PDF generation error: " + err, "error");
  }
}

async function im3GenerateDetailedReport() {
  try {
    const projectId = im3SelectedAnalysisProjectId ? im3SelectedAnalysisProjectId() : "";
    const language = im3SelectedReportLanguage();
    im3StartReportProgress("Technical investment report — " + im3ReportLanguageLabel(language), 90);
    im3ShowAlert("Generating technical investment report (" + im3ReportLanguageLabel(language) + ") in Google Drive...", "info");
    const result = await im3Jsonp("detailedreport", { filters: im3FilterParam(), projectId, language }, 150000);
    im3FinishReportProgress("Technical investment report generated successfully.");
    im3ShowAlert("Technical investment report generated. Use the report link below to open it.", "success");
    im3AppendReportLink(result, "Open Technical Investment Report — " + im3ReportLanguageLabel(language));
  } catch(err) {
    im3FailReportProgress("Detailed report generation failed: " + err);
    im3ShowAlert("Detailed report error: " + err, "error");
  }
}

async function im3GenerateInvestmentPack() {
  try {
    const projectId = im3SelectedAnalysisProjectId ? im3SelectedAnalysisProjectId() : "";
    const language = im3SelectedReportLanguage();
    im3StartReportProgress("Investment Decision Pack — " + im3ReportLanguageLabel(language), 180);
    im3ShowAlert("Generating Investment Decision Pack (" + im3ReportLanguageLabel(language) + ") in Google Drive...", "info");
    const result = await im3Jsonp("investmentpack", { filters: im3FilterParam(), projectId, language }, 240000);
    im3FinishReportProgress("Investment Decision Pack generated successfully.");
    im3ShowAlert("Investment Decision Pack generated. Use the report links below to open each file.", "success");
    im3AppendReportLink(result, "Investment Decision Pack — " + im3ReportLanguageLabel(language));
  } catch(err) {
    im3FailReportProgress("Investment Decision Pack generation failed: " + err);
    im3ShowAlert("Investment Decision Pack error: " + err, "error");
  }
}
function im3ToggleTheme() { const app=document.getElementById("im3-app"); const isNight=app.getAttribute("data-theme")==="night"; app.setAttribute("data-theme", isNight?"day":"night"); document.getElementById("im3ThemeText").textContent=isNight?"Night mode":"Day mode"; document.getElementById("im3ThemeIcon").src=isNight?"https://img.icons8.com/fluency-systems-regular/48/moon-symbol.png":"https://img.icons8.com/fluency-systems-regular/48/sun.png"; }

document.getElementById("im3RefreshBtn").addEventListener("click",()=>im3LoadModule(im3State.currentModule.id,document.getElementById("im3RowSelect").value));
document.getElementById("im3SaveBtn").addEventListener("click",()=>im3SaveCurrent());
document.getElementById("im3NextBtn").addEventListener("click",async()=>{const ok=await im3SaveCurrent(); if(ok) im3LoadModuleByIndex(im3State.moduleIndex+1);});
document.getElementById("im3BackBtn").addEventListener("click",()=>im3LoadModuleByIndex(im3State.moduleIndex-1));
document.getElementById("im3PdfBtn").addEventListener("click",im3GeneratePdf);
const im3DetailedBtn = document.getElementById("im3DetailedReportBtn");
if (im3DetailedBtn) im3DetailedBtn.addEventListener("click", im3GenerateDetailedReport);
const im3InvestmentPackBtn = document.getElementById("im3InvestmentPackBtn");
if (im3InvestmentPackBtn) im3InvestmentPackBtn.addEventListener("click", im3GenerateInvestmentPack);
const im3ClearReportsBtn = document.getElementById("im3ClearReportsBtn");
if (im3ClearReportsBtn) im3ClearReportsBtn.addEventListener("click", im3ClearGeneratedReports);
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
    const result = im3ValidateBeforeManualSave();
    if (!result.valid) {
      im3SetManualStatus("validation", "Validation failed: " + result.errors.join(" | "), "error");
      im3ShowAlert("Validation failed: " + result.errors.join(" | "), "error");
      return;
    }
    im3SetManualStatus("validation", result.warnings.length ? "Validation passed with warnings: " + result.warnings.join(" | ") : "Validation passed. Inputs are safe to save.", "success");
    im3ShowAlert(result.warnings.length ? "Validation passed with warnings." : "Validation passed. Inputs are safe to save.", "success");
  } catch (err) {
    im3SetManualStatus("validation", "Validation error: " + err, "error");
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

/* ===== v2.7 robust summary dashboard fallback =====
   Purpose: if the deployed Apps Script still does not expose action=summarydata,
   the dashboard summary card will fall back to action=dashboard instead of staying empty.
*/
function im3BuildFallbackSummaryCardsFromDashboard(viewId, dashboardData) {
  const summary = dashboardData.summary || {};
  const rows = dashboardData.rows || [];
  const first = dashboardData.first || rows[0] || {};
  const cards = [];
  const add = (label, value, format) => {
    if (value !== undefined && value !== null && value !== "") cards.push({ label, value, format: format || "number" });
  };

  if (viewId === "production_summary") {
    add("Rows", dashboardData.totalRowsAfterFilter || rows.length || summary.count, "integer");
    add("Best Project", (summary.bestProject && (summary.bestProject.Project_Name || summary.bestProject.Project_ID)) || first.Project_Name || first.Project_ID || "—", "text");
    add("Integrated Score", summary.avgIntegratedScore || first.Integrated_Score, "number");
    add("System Dynamics", summary.avgSD || first.System_Dynamics_Score, "number");
  } else if (viewId === "dcf_summary" || viewId === "dcf_results_summary") {
    add("Average NPV", summary.avgNPV || first.NPV_USD, "usd");
    add("Average IRR", summary.avgIRR || first.IRR, "percent");
    add("Payback Years", first.Payback_Years || first.Payback_Display, "number");
    add("DCF Score", first.DCF_Score, "number");
  } else if (viewId === "mcda_summary") {
    add("Average MCDA", summary.avgMCDA || first.MCDA_Score, "number");
    add("MCDA Rank", first.MCDA_Rank, "integer");
    add("Integrated Score", summary.avgIntegratedScore || first.Integrated_Score, "number");
  } else if (viewId === "system_dynamics_summary") {
    add("System Dynamics", summary.avgSD || first.System_Dynamics_Score, "number");
    add("Integrated Score", summary.avgIntegratedScore || first.Integrated_Score, "number");
    add("Market Risk", first.Market_Risk_Index || first.Risk_Label || first.Scenario_Risk_Class, "text");
  } else if (viewId === "monte_carlo_summary") {
    add("Monte Carlo Mean NPV", first.Monte_Carlo_Mean_NPV, "usd");
    add("Probability Positive NPV", first.Probability_Positive_NPV || first.Monte_Carlo_Display, "percent");
    add("Rows", dashboardData.totalRowsAfterFilter || rows.length || summary.count, "integer");
  } else {
    add("Rows", dashboardData.totalRowsAfterFilter || rows.length || summary.count, "integer");
    add("Average NPV", summary.avgNPV || first.NPV_USD, "usd");
    add("Average IRR", summary.avgIRR || first.IRR, "percent");
    add("Integrated Score", summary.avgIntegratedScore || first.Integrated_Score, "number");
  }

  if (!cards.length) {
    add("Rows", dashboardData.totalRowsAfterFilter || rows.length || 0, "integer");
    add("Project", first.Project_Name || first.Project_ID || "No project selected", "text");
  }

  return {
    title: "Dashboard fallback summary",
    note: "Summarydata endpoint is not available in the deployed Apps Script. Showing dashboard-based fallback indicators.",
    cards,
    rows
  };
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
    const projectId = typeof im3SelectedAnalysisProjectId === "function" ? im3SelectedAnalysisProjectId() : "";
    const data = await im3Jsonp("summarydata", { view: viewId, filters: im3FilterParam(), projectId }, 35000);
    im3RenderSummaryCards(data);
    if (meta) {
      const cleanNote = im3CleanVisualText(data.note || data.title || view.title);
      meta.textContent = cleanNote || "Dashboard indicators updated for the selected project.";
    }
  } catch (err) {
    const msg = String(err || "");
    if (/Unknown action:\s*summarydata/i.test(msg) || /summarydata/i.test(msg)) {
      try {
        const projectId = typeof im3SelectedAnalysisProjectId === "function" ? im3SelectedAnalysisProjectId() : "";
        const dashboardData = await im3Jsonp("dashboard", { filters: im3FilterParam(), projectId }, 35000);
        const fallback = im3BuildFallbackSummaryCardsFromDashboard(viewId, dashboardData || {});
        im3RenderSummaryCards(fallback);
        if (meta) meta.textContent = fallback.note + " To unlock full module-specific summaries, paste and deploy the updated Apps Script package.";
      } catch (fallbackErr) {
        if (meta) meta.textContent = "Could not load this dashboard view: " + fallbackErr;
        im3RenderSummaryCards({ cards: [] });
      }
    } else {
      if (meta) meta.textContent = "Could not load this dashboard view: " + err;
      im3RenderSummaryCards({ cards: [] });
    }
  }

  if (typeof im3AttachImageFallbacks === "function") im3AttachImageFallbacks();
}
/* ===== end v2.7 robust summary dashboard fallback ===== */


/* ===== v2.9 reference summary-card renderer =====
   Aligns the Tilda im3-summary-card with the Apps Script v1.9/v2.9
   card-based summarydata response. This final override intentionally avoids
   old table IDs and renders only into im3SummaryCards + im3SummarySource.
*/
function im3FormatSummaryCardValueV29(value, format) {
  if (value === undefined || value === null || value === "") return "—";
  const f = String(format || "").toLowerCase();
  const n = im3NumberValue(value);
  if (!isNaN(n)) {
    if (/percent/.test(f)) return ((Math.abs(n) <= 1 ? n * 100 : n).toFixed(2)) + "%";
    if (/money|usd|cash|npv|capex|opex|revenue|cost|price|value/.test(f)) {
      const abs = Math.abs(n);
      if (abs >= 1e9) return "USD " + (n / 1e9).toFixed(2) + "B";
      if (abs >= 1e6) return "USD " + (n / 1e6).toFixed(2) + "M";
      return "USD " + Number(n.toFixed(2)).toLocaleString();
    }
    if (/score/.test(f)) return Number(n.toFixed(2)).toLocaleString();
    if (/plain|integer/.test(f)) return Number.isInteger(n) ? String(n) : Number(n.toFixed(2)).toLocaleString();
  }
  return im3CleanVisualText(value);
}

function im3RenderSummaryCards(data) {
  const box = document.getElementById("im3SummaryCards");
  const source = document.getElementById("im3SummarySource");
  if (!box) return;

  let cards = Array.isArray(data?.cards) ? data.cards : [];
  if (!cards.length && Array.isArray(data?.rows) && data.rows.length) {
    const first = data.rows[0];
    cards = Object.keys(first).filter(k => !String(k).startsWith("__")).slice(0, 12).map(k => ({
      label: im3PrettyLabel(k),
      value: first[k],
      format: /usd|npv|capex|opex|revenue|cost|price|cash/i.test(k) ? "money" : (/rate|irr|probability|percent|%/i.test(k) ? "percent" : "plain"),
      source: data.sheetName || "summarydata"
    }));
  }

  if (!cards.length) {
    box.innerHTML = `<div class="im3-summary-empty">No summary indicators available for this view or filter.</div>`;
    if (source) source.textContent = data?.note || "No source data returned.";
    return;
  }

  box.innerHTML = cards.map(card => `
    <div class="im3-summary-kpi">
      <span>${im3Esc(im3CleanVisualText(card.label || "Indicator"))}</span>
      <strong>${im3Esc(im3FormatSummaryCardValueV29(card.value, card.format))}</strong>
      <small>${im3Esc(im3CleanVisualText(card.source || data.sourceRange || data.sourceSheet || "Google Sheets"))}</small>
    </div>
  `).join("");

  if (source) {
    const pieces = [];
    if (data.sourceSheet) pieces.push("Sheet: " + im3CleanVisualText(data.sourceSheet));
    if (data.sourceRange) pieces.push("Range: " + im3CleanVisualText(data.sourceRange));
    if (data.projectId) pieces.push("Project: " + im3CleanVisualText(data.projectId));
    if (data.version) pieces.push("API: " + im3CleanVisualText(data.version));
    source.textContent = pieces.length ? pieces.join(" | ") : (data.note || "Summary loaded from Google Sheets.");
  }
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
  if (meta) meta.textContent = "Loading " + view.title + "...";

  try {
    const projectId = typeof im3SelectedAnalysisProjectId === "function" ? im3SelectedAnalysisProjectId() : "";
    const data = await im3Jsonp("summarydata", { view: viewId, filters: im3FilterParam(), projectId }, 45000);
    im3RenderSummaryCards(data);
    if (meta) meta.textContent = im3CleanVisualText(data.note || data.message || (view.title + " loaded."));
  } catch (err) {
    try {
      const projectId = typeof im3SelectedAnalysisProjectId === "function" ? im3SelectedAnalysisProjectId() : "";
      const dashboardData = await im3Jsonp("dashboard", { filters: im3FilterParam(), projectId }, 35000);
      const fallback = typeof im3BuildFallbackSummaryCardsFromDashboard === "function"
        ? im3BuildFallbackSummaryCardsFromDashboard(viewId, dashboardData || {})
        : { cards: [] };
      im3RenderSummaryCards(fallback);
      if (meta) meta.textContent = "Fallback dashboard indicators loaded. Deploy the updated Apps Script to unlock full module summary blocks.";
    } catch (fallbackErr) {
      im3RenderSummaryCards({ cards: [] });
      if (meta) meta.textContent = "Could not load this dashboard view: " + fallbackErr;
    }
  }

  if (typeof im3AttachImageFallbacks === "function") im3AttachImageFallbacks();
}
/* ===== end v2.9 reference summary-card renderer ===== */

/* ============================================================
 * IM³ Framework MVP — Graph Studio Advanced Analytics v3.0
 * Additive frontend layer. Keeps existing time-series Graph Studio.
 * ============================================================ */

function im3IsAdvancedTemplateV30(template) {
  return template && (template.dataMode === "advanced" || template.chartKind || String(template.id || "").match(/radar|funnel|tornado|waterfall|distribution|heatmap|bubble|breakdown|alignment|confidence/i));
}

const im3RenderChartControlsV20Base = im3RenderChartControls;
im3RenderChartControls = function() {
  im3RenderChartControlsV20Base();
  const displaySelect = document.getElementById("chartDisplayType");
  if (displaySelect) {
    displaySelect.innerHTML = `
      <option value="auto">Automatic</option>
      <option value="line">Line</option>
      <option value="bar">Bar</option>
      <option value="radar">Radar</option>
      <option value="doughnut">Doughnut</option>
      <option value="scatter">Scatter</option>`;
  }
};

const im3ApplyGraphTemplateV20Base = im3ApplyGraphTemplate;
im3ApplyGraphTemplate = function(templateId) {
  im3ApplyGraphTemplateV20Base(templateId);
  const templates = im3State.metadata.graphTemplates || [];
  const template = templates.find(t => t.id === templateId) || templates[0] || {};
  const hint = document.getElementById("im3GraphHint");
  if (hint && im3IsAdvancedTemplateV30(template)) {
    hint.textContent = (template.description || "Advanced IM³ analytical chart.") + " This template reads model outputs directly and does not replace existing time-series graphs.";
  }
};

async function im3BuildChart() {
  try {
    const templates = im3State.metadata.graphTemplates || [];
    const template = templates.find(t => t.id === document.getElementById("chartTemplate")?.value) || {};

    if (im3IsAdvancedTemplateV30(template)) {
      document.getElementById("advancedChartTitle").textContent = template.title || "Advanced IM³ chart";
      const projectId = im3SelectedAnalysisProjectId ? im3SelectedAnalysisProjectId() : "";
      const data = await im3Jsonp("advancedchartdata", { templateId: template.id, filters: im3FilterParam(), projectId }, 60000);
      im3RenderAdvancedChartV30(data);
      im3State.chartBuilt = true;
      return;
    }

    if (!im3ValidateMetricSelectionV20()) {
      im3ShowAlert("Select compatible metrics before rendering the graph.", "error");
      return;
    }
    const metrics = im3SelectedMetricIdsV20();
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

function im3RenderAdvancedChartV30(data) {
  if (!data) {
    im3ShowAlert("No advanced chart data returned.", "info");
    im3ClearActiveChart();
    return;
  }
  const kind = data.chartType || data.template?.chartKind || "bar";
  if ((data.labels && data.labels.length === 0) && (!data.points || !data.points.length)) {
    im3ShowAlert(data.narrative || "No data available for this advanced chart.", "info");
    im3ClearActiveChart();
    return;
  }
  im3DestroyActiveChart();
  if (kind === "scatter") return im3RenderAdvancedScatterV30(data);
  if (kind === "radar") return im3RenderAdvancedRadarV30(data);
  if (kind === "doughnut") return im3RenderAdvancedDoughnutV30(data);
  return im3RenderAdvancedBarV30(data);
}

function im3RenderAdvancedBarV30(data) {
  const chartKind = data.template?.chartKind || data.chartType || "bar";
  const isHorizontal = chartKind === "horizontalBar" || data.indexAxis === "y";
  const datasets = (data.datasets || []).map(ds => ({
    label: ds.label || data.yLabel || "Value",
    data: ds.data || [],
    borderWidth: 1,
    borderRadius: 6
  }));
  im3State.charts.advanced = new Chart(document.getElementById("im3AdvancedChart"), {
    type: "bar",
    data: { labels: data.labels || [], datasets },
    options: {
      indexAxis: isHorizontal ? "y" : "x",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        tooltip: { mode: "nearest", intersect: false },
        title: { display: !!data.narrative, text: data.narrative || "" }
      },
      scales: {
        x: { title: { display: true, text: isHorizontal ? (data.yLabel || "Value") : "Category" }, grid: { display: !isHorizontal } },
        y: { title: { display: true, text: isHorizontal ? "Indicator" : (data.yLabel || "Value") }, grid: { color: "rgba(25,58,100,.10)" } }
      }
    }
  });
}

function im3RenderAdvancedRadarV30(data) {
  im3State.charts.advanced = new Chart(document.getElementById("im3AdvancedChart"), {
    type: "radar",
    data: {
      labels: data.labels || [],
      datasets: (data.datasets || []).map(ds => ({ label: ds.label || "Score", data: ds.data || [], borderWidth: 2, fill: true }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" }, title: { display: !!data.narrative, text: data.narrative || "" } },
      scales: { r: { beginAtZero: true, max: 100, ticks: { stepSize: 20 } } }
    }
  });
}

function im3RenderAdvancedDoughnutV30(data) {
  im3State.charts.advanced = new Chart(document.getElementById("im3AdvancedChart"), {
    type: "doughnut",
    data: { labels: data.labels || [], datasets: (data.datasets || [{ data: [] }]).map(ds => ({ label: ds.label || "Value", data: ds.data || [] })) },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: data.template?.chartKind === "gauge" ? "70%" : "60%",
      plugins: { legend: { position: "bottom" }, title: { display: !!data.narrative, text: data.narrative || "" } }
    }
  });
}

function im3RenderAdvancedScatterV30(data) {
  const points = (data.points || []).map(p => ({ x: p.x, y: p.y, label: p.label || "Point" }));
  im3State.charts.advanced = new Chart(document.getElementById("im3AdvancedChart"), {
    type: "scatter",
    data: { datasets: [{ label: data.template?.title || "Projects", data: points, pointRadius: 6, pointHoverRadius: 8 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      plugins: {
        legend: { position: "bottom" },
        title: { display: !!data.narrative, text: data.narrative || "" },
        tooltip: { callbacks: { label: ctx => `${ctx.raw.label}: ${ctx.raw.x}, ${ctx.raw.y}` } }
      },
      scales: {
        x: { title: { display: true, text: data.xLabel || "X" }, grid: { color: "rgba(25,58,100,.10)" } },
        y: { title: { display: true, text: data.yLabel || "Y" }, grid: { color: "rgba(25,58,100,.10)" } }
      }
    }
  });
}

/* ===== end Graph Studio Advanced Analytics v3.0 ===== */

/* ============================================================
 * IM³ Framework MVP — v4.1 Graph Studio Frontend Fix
 * Purpose:
 * - Uses action=timeseries reliably.
 * - Differentiates every metric/project series with a unique color.
 * - Handles multi-metric and multi-project comparisons cleanly.
 * ============================================================ */

function im3ChartColors() {
  return [
    "#193A64", "#E76F51", "#2A9D8F", "#F4A261", "#6A4C93", "#118AB2",
    "#EF476F", "#06D6A0", "#FFD166", "#073B4C", "#8D99AE", "#BC6C25",
    "#386641", "#7209B7", "#3A86FF", "#FB5607", "#8338EC", "#FF006E",
    "#457B9D", "#A7C957", "#F77F00", "#003049", "#9B5DE5", "#00BBF9"
  ];
}

function im3StableColorForSeriesV41(label, index) {
  const colors = im3ChartColors();
  const raw = String(label || "series");
  let hash = 0;
  for (let i = 0; i < raw.length; i++) hash = ((hash << 5) - hash) + raw.charCodeAt(i);
  const idx = Math.abs(hash + (index || 0)) % colors.length;
  return colors[idx];
}

function im3SelectedMetricIdsV41() {
  const selected = Array.from(document.querySelectorAll('#chartMetricsMulti input[type="checkbox"]:checked')).map(i => i.value);
  if (selected.length) return selected;
  const legacy = document.getElementById("chartMetric");
  return legacy && legacy.value ? [legacy.value] : [];
}

function im3ValidateMetricSelectionV20() {
  const selected = im3SelectedMetricIdsV41().map(im3MetricByIdV20).filter(Boolean);
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
  const units = [...new Set(selected.map(m => m.fallbackUnit || m.unit || "value"))];
  if (unitEl) {
    unitEl.textContent = incompatible
      ? "Incompatible units. Select metrics from the same unit group."
      : `Y-axis unit: ${units.join(" / ")} | ${selected.length} metric(s) selected`;
  }
  return !incompatible;
}

async function im3BuildChart() {
  try {
    const templates = im3State.metadata.graphTemplates || [];
    const template = templates.find(t => t.id === document.getElementById("chartTemplate")?.value) || {};

    if (typeof im3IsAdvancedTemplateV30 === "function" && im3IsAdvancedTemplateV30(template)) {
      document.getElementById("advancedChartTitle").textContent = template.title || "Advanced IM³ chart";
      const projectId = typeof im3SelectedAnalysisProjectId === "function" ? im3SelectedAnalysisProjectId() : "";
      const data = await im3Jsonp("advancedchartdata", { templateId: template.id, filters: im3FilterParam(), projectId }, 60000);
      im3RenderAdvancedChartV30(data);
      im3State.chartBuilt = true;
      return;
    }

    if (!im3ValidateMetricSelectionV20()) {
      im3ShowAlert("Select compatible metrics before rendering the graph.", "error");
      return;
    }

    const metrics = im3SelectedMetricIdsV41();
    const metricLabels = metrics.map(id => im3MetricByIdV20(id)?.label || id);
    const displayType = document.getElementById("chartDisplayType")?.value || "auto";
    const chartType = displayType === "auto" ? (template.defaultChart || "line") : displayType;
    const groupBy = document.getElementById("chartGroupBy")?.value || "Project_Name";

    const title = `${template.title || "Time Series"} — ${metricLabels.join(", ")}`;
    const titleEl = document.getElementById("advancedChartTitle");
    if (titleEl) titleEl.textContent = title;

    const data = await im3Jsonp("timeseries", {
      filters: im3FilterParam(),
      metrics: im3Encode(metrics),
      groupBy: groupBy || "Project_Name"
    }, 60000);

    if (!data.series || !data.series.some(s => s.data && s.data.length)) {
      im3ShowAlert("No data found for selected metrics/projects and filters.", "info");
      im3ClearActiveChart();
      return;
    }

    im3State.chartBuilt = true;
    im3RenderTimeSeriesV20(data, chartType);
  } catch (err) {
    im3ShowAlert("Chart error: " + err, "error");
    console.error("Graph Studio error", err);
  }
}

function im3RenderTimeSeriesV20(data, chartType) {
  const allPoints = (data.series || []).flatMap(s => s.data || []);
  const years = (data.years && data.years.length)
    ? data.years.map(String).sort((a,b) => Number(a) - Number(b))
    : [...new Set(allPoints.map(p => String(p.year)))].sort((a,b) => Number(a) - Number(b));

  const datasets = [];
  let colorIndex = 0;

  (data.series || []).forEach(s => {
    const names = [...new Set((s.data || []).map(p => String(p.series || s.label || s.metricId || "Series")))];
    names.forEach(name => {
      const label = names.length > 1 ? `${s.label || s.metricId} — ${im3CleanOptionLabel(name)}` : (s.label || s.metricId || im3CleanOptionLabel(name));
      const color = im3StableColorForSeriesV41(label, colorIndex++);
      datasets.push({
        label,
        data: years.map(y => {
          const p = (s.data || []).find(d => String(d.year) === String(y) && String(d.series || s.label || s.metricId) === String(name));
          return p ? Number(p.value) : null;
        }),
        borderWidth: chartType === "bar" ? 1.6 : 2.8,
        tension: .25,
        fill: false,
        spanGaps: true,
        borderColor: color,
        backgroundColor: chartType === "bar" ? color : color,
        pointBackgroundColor: color,
        pointBorderColor: color,
        pointRadius: chartType === "line" ? 3 : 0,
        pointHoverRadius: 5,
        borderRadius: chartType === "bar" ? 6 : 0
      });
    });
  });

  im3DestroyActiveChart();
  const canvas = document.getElementById("im3AdvancedChart");
  if (!canvas) return;

  const finalType = chartType === "bar" ? "bar" : "line";
  im3State.charts.advanced = new Chart(canvas, {
    type: finalType,
    data: { labels: years, datasets },
    options: {
      responsive:true,
      maintainAspectRatio:false,
      interaction:{ mode:"nearest", intersect:false },
      plugins:{
        legend:{
          position:"bottom",
          labels:{ usePointStyle:true, boxWidth:10, padding:14 }
        },
        tooltip:{
          mode:"nearest",
          intersect:false,
          callbacks:{
            label: ctx => `${ctx.dataset.label}: ${im3FormatChartValueV41(ctx.parsed.y, data.yUnit)}`
          }
        }
      },
      scales:{
        x:{ title:{ display:true, text:"Year" }, grid:{ display:false } },
        y:{ title:{ display:true, text:data.yUnit || "Value" }, grid:{ color:"rgba(25,58,100,.10)" } }
      }
    }
  });

  const hint = document.getElementById("im3GraphHint");
  if (hint) {
    hint.textContent = `${datasets.length} series rendered. Each metric/project combination has a distinct color. Unit: ${data.yUnit || "Value"}.`;
  }
}

function im3FormatChartValueV41(value, unit) {
  const n = Number(value);
  if (isNaN(n)) return String(value ?? "—");
  const u = String(unit || "");
  if (/usd/i.test(u)) return "$" + (Math.abs(n) >= 1000000 ? (n/1000000).toFixed(2) + "M" : n.toLocaleString(undefined, { maximumFractionDigits:2 }));
  if (u === "%" || /percent/i.test(u)) return (Math.abs(n) <= 1 ? n * 100 : n).toFixed(2) + "%";
  if (Math.abs(n) >= 1000000) return (n/1000000).toFixed(2) + "M";
  return n.toLocaleString(undefined, { maximumFractionDigits:4 });
}

/* ============================================================
 * IM³ Tilda Frontend V70 — Manual save integrity client
 * ============================================================ */

function im3ManualStatusEl() {
  return document.getElementById("im3ManualSaveStatus");
}

function im3SetManualStatus(step, message, type="info") {
  const el = im3ManualStatusEl();
  if (!el) return;
  el.className = "im3-manual-status " + type;
  el.innerHTML = `<strong>${im3Esc(im3PrettyLabel(step || "status"))}</strong><span>${im3Esc(message || "")}</span>`;
}

function im3SetSaveBusy(isBusy, message) {
  im3State.saving = !!isBusy;
  ["im3SaveBtn", "im3NextBtn", "im3ValidateBtn", "im3ReloadResultsBtn"].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = !!isBusy;
  });
  if (message) im3SetManualStatus("save progress", message, "info");
}

function im3CollectEditablePayload() {
  const form = document.getElementById("im3Form");
  const moduleMeta = im3State.currentModule || {};
  const payload = {};
  if (!form || moduleMeta.readOnly) return payload;
  Array.from(new FormData(form).entries()).forEach(([key, value]) => {
    const currentValue = im3State.currentSelected ? im3State.currentSelected[key] : "";
    if (!im3IsEditableField(moduleMeta, key)) return;
    if (im3IsCalculatedField(key, currentValue)) return;
    if (value === "" && im3IsCalculatedField(key, value)) return;
    payload[key] = value;
  });
  return payload;
}

function im3DropdownManualWarnings(payload) {
  const form = document.getElementById("im3Form");
  const warnings = [];
  if (!form) return warnings;
  form.querySelectorAll("[data-dropdown-field='true']").forEach(input => {
    const key = input.name;
    const value = String(payload[key] ?? "").trim();
    if (!value) return;
    const listId = input.getAttribute("list");
    const list = listId ? document.getElementById(listId) : null;
    const options = list ? Array.from(list.options).map(o => String(o.value || "").trim()).filter(Boolean) : [];
    if (options.length && !options.some(o => o.toLowerCase() === value.toLowerCase())) {
      warnings.push(im3PrettyLabel(key) + " uses a manual value not found in the Google Sheets list.");
    }
  });
  return warnings;
}

function im3ValidateBeforeManualSave() {
  const errors = [];
  const warnings = [];
  const moduleMeta = im3State.currentModule || {};
  const payload = im3CollectEditablePayload();
  const rowSelect = document.getElementById("im3RowSelect");
  const isNew = !rowSelect || rowSelect.value === "__new__";
  warnings.push(...im3DropdownManualWarnings(payload));

  if (!moduleMeta.id) errors.push("No active module selected.");
  if (moduleMeta.readOnly) errors.push("This module is read-only and cannot be saved manually.");
  if (moduleMeta.id === "projects" && isNew && !String(payload.Project_Name || "").trim()) errors.push("Project_Name is required for a new project.");
  if (["assumptions","production","prices","capex_opex","mcda_scores"].includes(moduleMeta.id) && !String(payload.Project_ID || "").trim()) errors.push("Project_ID is required for this module.");
  if (["production","prices","capex_opex","risk_scenarios","map_dnpv","rov","mcda_scores","system_dynamics","sd_parameters","sensitivity","monte_carlo"].includes(moduleMeta.id) && !String(payload.Assumption_Set_ID || "").trim()) errors.push("Assumption_Set_ID is required for this module.");
  if ((moduleMeta.editableFields || []).includes("Year") && !String(payload.Year || "").trim()) errors.push("Year is required for this module.");

  Object.entries(payload).forEach(([key, value]) => {
    if (value === "" || value === null || value === undefined) return;
    const raw = String(value).trim();
    if (im3IsFourDigitYearField(key) && !/^\d{4}$/.test(raw)) errors.push(key + " must be a four-digit year.");
    if (im3IsNumericField(key)) {
      const normalized = raw.replace(/,/g, "").replace(/%/g, "").replace(/[^0-9.-]/g, "");
      if (normalized === "" || isNaN(Number(normalized))) errors.push(key + " must be numeric.");
    }
  });

  return { valid:errors.length === 0, errors, warnings, payload };
}

async function im3SaveManualInput() {
  if (im3State.saving) return false;
  try {
    const validation = im3ValidateBeforeManualSave();
    if (!validation.valid) {
      im3SetManualStatus("validation status", "Validation failed: " + validation.errors.join(" | "), "error");
      im3ShowAlert("Save blocked: " + validation.errors.join(" | "), "error");
      return false;
    }

    const rowSelect = document.getElementById("im3RowSelect");
    const rowId = rowSelect && rowSelect.value !== "__new__" ? rowSelect.value : "";
    im3SetSaveBusy(true, "Saving to Google Sheets...");
    const result = await im3Jsonp("manualsave", {
      moduleId: im3State.currentModule.id,
      key: rowId,
      rowId,
      payload: im3Encode(validation.payload)
    }, 60000);

    im3SetManualStatus("calculation status", "Recalculating model...", "info");
    await im3RefreshAfterManualSave(result);
    im3SetManualStatus("success", "Results updated.", "success");
    im3ShowAlert((result.mode === "insert" ? "New record saved: " : "Record updated: ") + (result.keyValue || ""), "success");
    return true;
  } catch (err) {
    im3SetManualStatus("error message", String(err), "error");
    im3ShowAlert("Manual save error: " + err, "error");
    return false;
  } finally {
    im3SetSaveBusy(false);
  }
}

async function im3RefreshAfterManualSave(result={}) {
  await im3ReloadDropdownsAfterManualSave();
  const moduleId = result.moduleId || im3State.currentModule?.id;
  const key = result.keyValue || "";
  if (moduleId) await im3LoadModule(moduleId, key);
  await im3LoadDashboard();
  await im3LoadSelectedSummary();
  if (im3State.chartBuilt) await im3BuildChart();
}

async function im3ReloadDropdownsAfterManualSave() {
  try {
    const filtersPromise = im3Jsonp("filteroptions", {}, 35000).catch(() => im3State.filterOptions || {});
    const dropdownsPromise = im3Jsonp("dropdowns", { scope:"all" }, 35000)
      .catch(() => im3Jsonp("configoptions", {}, 35000))
      .catch(() => im3State.dropdowns || {});
    const loaded = await Promise.all([filtersPromise, dropdownsPromise]);
    im3State.filterOptions = loaded[0] || im3State.filterOptions || {};
    im3State.dropdowns = im3NormalizeDropdownPayload(loaded[1] || {}, im3State.metadata?.dropdowns || {}, im3State.filterOptions);
    if (im3State.metadata) {
      im3State.metadata.filters = im3State.filterOptions;
      im3State.metadata.dropdowns = im3State.dropdowns;
    }
  } catch (err) {
    im3SetManualStatus("calculation status", "Saved, but dropdown refresh failed: " + err, "info");
  }
}

im3SaveCurrent = async function() {
  return im3SaveManualInput();
};

document.addEventListener("DOMContentLoaded", () => {
  const reloadBtn = document.getElementById("im3ReloadResultsBtn");
  if (reloadBtn) reloadBtn.addEventListener("click", async () => {
    im3SetManualStatus("calculation status", "Reloading calculated results...", "info");
    await im3RefreshAfterManualSave({});
    im3SetManualStatus("success", "Results updated.", "success");
  });
});
