import React from "react";
import ReactDOM from "react-dom/client";
import {
  Activity,
  Anchor,
  ArrowDownToLine,
  BadgeCheck,
  BookOpen,
  Database,
  ExternalLink,
  FileJson,
  FlaskConical,
  Github,
  Loader2,
  Radio,
  RefreshCcw,
  Server,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  Waves
} from "lucide-react";
import "./styles.css";

type DatasetId = "breast_cancer" | "cervical_cancer" | "usa_housing";
type Method = "mdav" | "laplace";

interface DatasetInfo {
  id: DatasetId;
  label: string;
  task: "classification" | "regression";
  description: string;
  paperRole: string;
  sourceNote: string;
}

interface FeatureImportance {
  feature: string;
  importance: number;
  rank: number;
}

interface ModelSummary {
  utilityMetric: string;
  utility: number;
  secondary: Record<string, number>;
  topFeatures: FeatureImportance[];
  allFeatureImportances: FeatureImportance[];
}

interface ExperimentResult {
  schema: string;
  dataset: {
    id: DatasetId;
    label: string;
    task: "classification" | "regression";
    rows: number;
    features: number;
    target: string;
    sourceNote: string;
    hash: string;
  };
  privacy: {
    method: string;
    parameter: string;
    value: number;
    plainEnglish: string;
  };
  baseline: ModelSummary;
  protected: ModelSummary;
  comparison: {
    utilityDelta: number;
    rankCorrelation: number;
    irregularity: number;
    explanationDistortion: number;
    plainEnglish: string;
  };
  manifest: {
    schema: string;
    paper: string;
    dataset: DatasetId;
    datasetHash: string;
    method: Method;
    config: Record<string, unknown>;
    featureNames: string[];
    manifestHash: string;
  };
  latencyMs: number;
  resultHash: string;
}

const SPACE_URL = (import.meta.env.VITE_SPACE_URL || "").replace(/\/$/, "");
const API_BASE = SPACE_URL || "/space";
const SPACE_DISPLAY = SPACE_URL || "local Vite proxy -> http://127.0.0.1:7860";

const FALLBACK_DATASETS: DatasetInfo[] = [
  {
    id: "breast_cancer",
    label: "Breast Cancer Coimbra",
    task: "classification",
    description: "Small medical table: biomarkers in, cancer/control class out.",
    paperRole: "classification dataset",
    sourceNote: "UCI dataR2.csv"
  },
  {
    id: "cervical_cancer",
    label: "Cervical Cancer Risk Factors",
    task: "classification",
    description: "Survey and diagnosis-risk fields, predicting biopsy outcome.",
    paperRole: "classification dataset",
    sourceNote: "UCI risk_factors_cervical_cancer.csv"
  },
  {
    id: "usa_housing",
    label: "USA Housing",
    task: "regression",
    description: "Housing attributes in, sale price out.",
    paperRole: "regression dataset",
    sourceNote: "Hugging Face USA-housing-compatible CSV"
  }
];

function App() {
  const [datasets, setDatasets] = React.useState<DatasetInfo[]>(FALLBACK_DATASETS);
  const [dataset, setDataset] = React.useState<DatasetId>("breast_cancer");
  const [method, setMethod] = React.useState<Method>("mdav");
  const [k, setK] = React.useState(5);
  const [noiseScale, setNoiseScale] = React.useState(2);
  const [nEstimators, setNEstimators] = React.useState(120);
  const [result, setResult] = React.useState<ExperimentResult | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [health, setHealth] = React.useState<"unchecked" | "ok" | "bad">("unchecked");

  const datasetInfo = datasets.find((item) => item.id === dataset) || FALLBACK_DATASETS[0];
  const runPayload = React.useMemo(
    () => ({
      dataset,
      method,
      k,
      noise_scale: noiseScale,
      n_estimators: nEstimators
    }),
    [dataset, method, k, noiseScale, nEstimators]
  );

  React.useEffect(() => {
    void checkHealth();
    void loadDatasets();
  }, []);

  async function checkHealth() {
    try {
      const response = await fetch(`${API_BASE}/healthz`);
      setHealth(response.ok ? "ok" : "bad");
    } catch {
      setHealth("bad");
    }
  }

  async function loadDatasets() {
    try {
      const response = await fetch(`${API_BASE}/datasets`);
      if (!response.ok) return;
      const body = (await response.json()) as { datasets?: DatasetInfo[] };
      if (Array.isArray(body.datasets) && body.datasets.length > 0) {
        setDatasets(body.datasets);
      }
    } catch {
      // The fallback list keeps the UI usable while the Space is offline.
    }
  }

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(runPayload)
      });
      const body = await response.json();
      if (!response.ok || !body.ok) {
        throw new Error(body.detail || body.error || "Experiment failed");
      }
      setResult(body.result as ExperimentResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function downloadResult() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `privacy-xai-${result.dataset.id}-${result.manifest.manifestHash.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app">
      <header className="top">
        <div className="brand">
          <div className="mark">
            <Server />
          </div>
          <div>
            <div className="brand-title">Privacy XAI Space Demo</div>
            <div className="brand-sub">Hugging Face hosted runner for SHAP privacy experiments</div>
          </div>
        </div>
        <div className="top-actions">
          <StatusPill state={health} />
          <button className="ghost" type="button" onClick={() => void checkHealth()}>
            <RefreshCcw />
            Ping Space
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Hosted demo, not a notebook</span>
          <h1>Send a privacy experiment to Hugging Face and inspect the explanation drift.</h1>
          <p>
            This is a software-engineer version of the paper workflow. The Space fetches
            a tabular dataset, applies a privacy transform, trains tree models, computes
            SHAP feature rankings, and returns one JSON result you can inspect or anchor.
          </p>
        </div>

        <div className="space-console">
          <SectionHead icon={<Radio />} label="Runner" title="Hugging Face Space" compact />
          <div className="endpoint-row">
            <span>Base URL</span>
            <code>{SPACE_DISPLAY}</code>
          </div>
          <div className="endpoint-row">
            <span>Request</span>
            <code>POST {API_BASE}/run</code>
          </div>
          <div className="endpoint-status" data-state={health}>
            <strong>{health === "ok" ? "Ready" : health === "bad" ? "Offline" : "Unchecked"}</strong>
            <span>
              {health === "ok"
                ? "The frontend can reach the Space API."
                : "Run the local Space or set VITE_SPACE_URL to a hosted HF Space."}
            </span>
          </div>
          <div className="space-actions">
            {SPACE_URL ? (
              <a href={SPACE_URL} target="_blank" rel="noreferrer">
                <ExternalLink />
                Open Space
              </a>
            ) : (
              <span className="disabled-action">Set VITE_SPACE_URL for hosted Space</span>
            )}
          </div>
        </div>
      </section>

      <section className="workspace">
        <div className="control-panel">
          <SectionHead icon={<SlidersHorizontal />} label="Experiment" title="Configure one run" />

          <div className="field">
            <span>Dataset served by the Space</span>
            <div className="dataset-grid">
              {datasets.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  data-active={dataset === item.id}
                  onClick={() => setDataset(item.id)}
                >
                  <strong>{item.label}</strong>
                  <em>
                    {item.task} · {item.sourceNote}
                  </em>
                </button>
              ))}
            </div>
          </div>

          <div className="method-row">
            <button
              type="button"
              data-active={method === "mdav"}
              onClick={() => setMethod("mdav")}
            >
              <Shield />
              <span>MDAV / k-anonymity</span>
            </button>
            <button
              type="button"
              data-active={method === "laplace"}
              onClick={() => setMethod("laplace")}
            >
              <Waves />
              <span>Laplace noise</span>
            </button>
          </div>

          <div className="slider-stack">
            {method === "mdav" ? (
              <Slider
                label="k-anonymity"
                value={k}
                min={1}
                max={20}
                step={1}
                onChange={setK}
                explain="Higher k groups more nearby rows together. Stronger privacy, more distortion."
              />
            ) : (
              <Slider
                label="Noise scale"
                value={noiseScale}
                min={0.1}
                max={12}
                step={0.1}
                onChange={setNoiseScale}
                explain="Higher scale adds more Laplace noise. Stronger masking, weaker fidelity."
              />
            )}
            <Slider
              label="Forest size"
              value={nEstimators}
              min={25}
              max={300}
              step={25}
              onChange={setNEstimators}
              explain="More trees smooth out noise but take longer on the hosted Space."
            />
          </div>

          <div className="dataset-note">
            <Database />
            <div>
              <strong>{datasetInfo.description}</strong>
              <span>{datasetInfo.paperRole}</span>
            </div>
          </div>

          <button className="run" type="button" onClick={() => void run()} disabled={busy}>
            {busy ? <Loader2 className="spin" /> : <FlaskConical />}
            {busy ? "Running on Hugging Face..." : "Run on Hugging Face Space"}
          </button>
          {error && <div className="error">{error}</div>}
        </div>

        <div className="result-panel">
          {!result ? (
            <EmptyResult payload={runPayload} />
          ) : (
            <ResultView result={result} onDownload={downloadResult} />
          )}
        </div>
      </section>

      <section className="explainer-band">
        <div className="band-title">
          <span className="eyebrow">Read this first</span>
          <h2>Interpretability here means “can the explanation survive private data?”</h2>
        </div>
        <div className="concept-grid">
          <ConceptCard
            icon={<Shield />}
            title="Privacy transform"
            body="MDAV replaces rows with nearby group averages. Laplace adds numeric noise. Both make an individual row harder to recover."
          />
          <ConceptCard
            icon={<Sparkles />}
            title="SHAP explanation"
            body="SHAP ranks input columns by how much they contributed to the tree model’s predictions. It is feature attribution, not neural circuit analysis."
          />
          <ConceptCard
            icon={<Activity />}
            title="Tradeoff"
            body="A good run keeps prediction utility high and keeps the protected explanation close to the baseline explanation."
          />
          <ConceptCard
            icon={<Anchor />}
            title="Solana provenance"
            body="Optional devnet anchoring stores hashes of the dataset, manifest, and result. It makes the artifact harder to quietly rewrite."
          />
        </div>
      </section>

      <footer className="footer">
        <span>Colab is only for reading the original notebooks.</span>
        <a href={colabUrl(dataset)} target="_blank" rel="noreferrer">
          <BookOpen />
          Open matching Colab
        </a>
        <a
          href="https://github.com/bozorgpanah/The-Explainable-Machine-Learning-Model-withPrivacy"
          target="_blank"
          rel="noreferrer"
        >
          <Github />
          Paper code
        </a>
      </footer>
    </main>
  );
}

function ResultView({
  result,
  onDownload
}: {
  result: ExperimentResult;
  onDownload: () => void;
}) {
  const metric = result.baseline.utilityMetric;
  const anchorCommand = `npm run anchor -- results/${result.manifest.manifestHash}.json`;
  return (
    <div className="result">
      <SectionHead icon={<BadgeCheck />} label="Space response" title="Experiment result" />
      <div className="result-story">
        <strong>{result.privacy.method}</strong>
        <span>{result.comparison.plainEnglish}</span>
      </div>

      <div className="metric-grid">
        <Metric label={`Baseline ${metric}`} value={formatMetric(result.baseline.utility)} tone="plain" />
        <Metric
          label={`Private-data ${metric}`}
          value={formatMetric(result.protected.utility)}
          tone={result.comparison.utilityDelta >= -0.03 ? "good" : "warn"}
        />
        <Metric
          label="Explanation similarity"
          value={formatMetric(result.comparison.rankCorrelation)}
          tone={result.comparison.rankCorrelation > 0.65 ? "good" : "warn"}
        />
        <Metric
          label="Rank movement"
          value={formatMetric(result.comparison.irregularity)}
          tone={result.comparison.irregularity < 2 ? "good" : "warn"}
        />
      </div>

      <div className="compare">
        <FeatureList title="Original data model" items={result.baseline.topFeatures} />
        <FeatureList title="Private-data model" items={result.protected.topFeatures} />
      </div>

      <div className="response-grid">
        <div className="response-card">
          <FileJson />
          <span>Dataset</span>
          <strong>
            {result.dataset.rows.toLocaleString()} rows · {result.dataset.features} features
          </strong>
          <code>{shortHash(result.dataset.hash)}</code>
        </div>
        <div className="response-card">
          <Terminal />
          <span>Manifest hash</span>
          <strong>{shortHash(result.manifest.manifestHash)}</strong>
          <code>{result.latencyMs.toLocaleString()} ms Space latency</code>
        </div>
        <div className="response-card">
          <BadgeCheck />
          <span>Result hash</span>
          <strong>{shortHash(result.resultHash)}</strong>
          <code>{result.schema}</code>
        </div>
      </div>

      <div className="actions">
        <button type="button" onClick={onDownload}>
          <ArrowDownToLine />
          Download JSON
        </button>
        <a href={colabUrl(result.dataset.id)} target="_blank" rel="noreferrer">
          <BookOpen />
          Original Colab
        </a>
        <a
          href="https://github.com/bozorgpanah/The-Explainable-Machine-Learning-Model-withPrivacy"
          target="_blank"
          rel="noreferrer"
        >
          <Github />
          Paper code
        </a>
      </div>

      <div className="anchor-box">
        <div>
          <strong>Optional Solana devnet anchor</strong>
          <span>
            Save the JSON under `results/` and store the manifest hash as a Solana Memo.
            The chain records provenance; it does not rerun or verify the ML.
          </span>
        </div>
        <code>{anchorCommand}</code>
      </div>
    </div>
  );
}

function EmptyResult({ payload }: { payload: Record<string, unknown> }) {
  return (
    <div className="empty">
      <SectionHead icon={<Terminal />} label="Pending request" title="What the Space will run" />
      <div className="request-preview">
        <code>{JSON.stringify(payload, null, 2)}</code>
      </div>
      <div className="empty-steps">
        <Step label="1" title="Train baseline" body="Random forest on the original dataset." />
        <Step label="2" title="Protect rows" body="MDAV or Laplace transforms the training data." />
        <Step label="3" title="Compare SHAP" body="Feature rankings reveal whether the explanation changed." />
      </div>
    </div>
  );
}

function Step({ label, title, body }: { label: string; title: string; body: string }) {
  return (
    <div className="step">
      <span>{label}</span>
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

function SectionHead({
  icon,
  label,
  title,
  compact = false
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  compact?: boolean;
}) {
  return (
    <div className="section-head" data-compact={compact}>
      <div className="head-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <h2>{title}</h2>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  explain,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  explain: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="slider">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <em>{explain}</em>
    </label>
  );
}

function Metric({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "plain" | "good" | "warn";
}) {
  return (
    <div className="metric" data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FeatureList({ title, items }: { title: string; items: FeatureImportance[] }) {
  return (
    <div className="features">
      <h3>{title}</h3>
      {items.slice(0, 7).map((item) => (
        <div className="feature-row" key={`${title}-${item.feature}`}>
          <span>{item.rank}</span>
          <strong title={item.feature}>{item.feature}</strong>
          <i>
            <b style={{ width: `${Math.max(4, item.importance * 100)}%` }} />
          </i>
          <em>{Math.round(item.importance * 100)}%</em>
        </div>
      ))}
    </div>
  );
}

function ConceptCard({
  icon,
  title,
  body
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="concept">
      <div>{icon}</div>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function StatusPill({ state }: { state: "unchecked" | "ok" | "bad" }) {
  return (
    <div className="status" data-state={state}>
      <span />
      {state === "ok" ? "Space online" : state === "bad" ? "Space offline" : "Space unchecked"}
    </div>
  );
}

function colabUrl(dataset: DatasetId): string {
  const notebooks: Record<DatasetId, string> = {
    breast_cancer: "Paper1/MDAV%2BSHAP_BrestCancer_.ipynb",
    cervical_cancer: "Paper1/MDAV%2BSHAP_CervicalCancer_1.ipynb",
    usa_housing: "Paper1/MDAV%2BSHAP_USAHousing.ipynb"
  };
  return `https://colab.research.google.com/github/bozorgpanah/The-Explainable-Machine-Learning-Model-withPrivacy/blob/main/${notebooks[dataset]}`;
}

function formatMetric(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  return value.toFixed(3);
}

function shortHash(value: string): string {
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
