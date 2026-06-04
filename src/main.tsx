import React from "react";
import ReactDOM from "react-dom/client";
import {
  Activity,
  Anchor,
  ArrowDownToLine,
  BadgeCheck,
  BookOpen,
  BrainCircuit,
  Database,
  ExternalLink,
  FileJson,
  FlaskConical,
  GitCompareArrows,
  Github,
  HelpCircle,
  Layers3,
  Loader2,
  LockKeyhole,
  Radio,
  RefreshCcw,
  Server,
  Shield,
  Sigma,
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
      // Keep the page teachable even before the Space is deployed.
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
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <BrainCircuit />
          </div>
          <div>
            <strong>Privacy XAI Replication</strong>
            <span>Explainer-first demo for engineers</span>
          </div>
        </div>
        <nav className="top-actions" aria-label="Project actions">
          <StatusPill state={health} />
          <button type="button" onClick={() => void checkHealth()}>
            <RefreshCcw />
            Ping Space
          </button>
          <a href="#lab">
            <FlaskConical />
            Run demo
          </a>
        </nav>
      </header>

      <section className="opening">
        <div className="opening-copy">
          <span className="kicker">The question</span>
          <h1>If we hide the user rows, do the explanations still mean anything?</h1>
          <p>
            This project turns a privacy-preserving explainable AI paper into a
            hosted demo. You do not need to know SHAP, k-anonymity, or ML privacy
            first. Read the story, run the Space, then inspect what changed.
          </p>
        </div>
        <div className="truth-panel">
          <span>What this is</span>
          <strong>Private user data + public model behavior</strong>
          <p>
            The backend transforms tabular datasets before retraining tree models.
            The model is not secret. The experiment asks whether feature-level
            explanations survive after privacy protection.
          </p>
          <div className="not-this">
            <HelpCircle />
            <span>Not private model weights. Not neural circuit analysis. Not a proof that the science is correct.</span>
          </div>
        </div>
      </section>

      <section className="story-strip" aria-label="Experiment walkthrough">
        <StoryStep
          icon={<Database />}
          number="01"
          title="Start with rows"
          body="A dataset contains individual records: biomarkers, survey answers, or housing attributes."
        />
        <StoryStep
          icon={<LockKeyhole />}
          number="02"
          title="Blur the records"
          body="MDAV groups nearby rows into representatives. Laplace noise perturbs numeric columns."
        />
        <StoryStep
          icon={<Layers3 />}
          number="03"
          title="Train again"
          body="The Space trains one tree model on original data and one on privacy-protected data."
        />
        <StoryStep
          icon={<GitCompareArrows />}
          number="04"
          title="Compare explanations"
          body="TreeSHAP ranks the most influential features in both models. Similar ranks mean the explanation survived."
        />
      </section>

      <section className="primer">
        <div className="primer-lead">
          <span className="kicker">How to read the output</span>
          <h2>The demo is a tradeoff meter, not a magic privacy certificate.</h2>
        </div>
        <div className="primer-grid">
          <PrimerCard
            icon={<Activity />}
            title="Utility"
            body="Did the private-data model still predict well? The UI reports accuracy for classification and R2 for regression."
          />
          <PrimerCard
            icon={<Sparkles />}
            title="SHAP rank correlation"
            body="Did the same features stay important? A higher correlation means the protected explanation resembles the baseline."
          />
          <PrimerCard
            icon={<Sigma />}
            title="Rank movement"
            body="How much did feature order move? Lower movement means the story told by the explanation changed less."
          />
          <PrimerCard
            icon={<Anchor />}
            title="Provenance"
            body="The Solana memo stores hashes of the run artifact. It records what was shown, not whether the model was right."
          />
        </div>
      </section>

      <section className="lab" id="lab">
        <div className="lab-intro">
          <span className="kicker">Runnable lab</span>
          <h2>Send one typed request to the Hugging Face Space.</h2>
          <p>
            The frontend does not execute notebooks and does not accept arbitrary
            Python. It sends a small JSON request to a parameterized runner.
          </p>
        </div>

        <div className="lab-grid">
          <aside className="control-panel">
            <SectionHead icon={<SlidersHorizontal />} label="Request builder" title="Choose a run" />

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
                      {item.task} / {item.sourceNote}
                    </em>
                  </button>
                ))}
              </div>
            </div>

            <div className="method-row" aria-label="Privacy method">
              <button
                type="button"
                data-active={method === "mdav"}
                onClick={() => setMethod("mdav")}
              >
                <Shield />
                <span>MDAV groups</span>
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
                  explain="Higher k groups more rows together. Stronger privacy, more distortion."
                />
              ) : (
                <Slider
                  label="Noise scale"
                  value={noiseScale}
                  min={0.1}
                  max={12}
                  step={0.1}
                  onChange={setNoiseScale}
                  explain="Higher scale adds more noise. Stronger masking, weaker fidelity."
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

            <button className="run-button" type="button" onClick={() => void run()} disabled={busy}>
              {busy ? <Loader2 className="spin" /> : <FlaskConical />}
              {busy ? "Running on Hugging Face..." : "Run the experiment"}
            </button>
            {error && <div className="error">{error}</div>}
          </aside>

          <div className="lab-main">
            <div className="space-card">
              <SectionHead icon={<Radio />} label="Backend" title="Space connection" compact />
              <div className="endpoint-grid">
                <EndpointLine label="Base URL" value={SPACE_DISPLAY} />
                <EndpointLine label="Request" value={`POST ${API_BASE}/run`} />
                <div className="health-card" data-state={health}>
                  <strong>{health === "ok" ? "Space reachable" : health === "bad" ? "Space offline" : "Not checked"}</strong>
                  <span>
                    {health === "ok"
                      ? "The browser can reach the API for dataset metadata and runs."
                      : "Deploy the Space and set VITE_SPACE_URL, or run the backend locally."}
                  </span>
                </div>
              </div>
              {SPACE_URL ? (
                <a className="space-link" href={SPACE_URL} target="_blank" rel="noreferrer">
                  <ExternalLink />
                  Open Hugging Face Space
                </a>
              ) : (
                <div className="space-link muted-link">Set VITE_SPACE_URL for the hosted Space.</div>
              )}
            </div>

            {!result ? (
              <EmptyResult payload={runPayload} />
            ) : (
              <ResultView result={result} onDownload={downloadResult} />
            )}
          </div>
        </div>
      </section>

      <section className="boundary">
        <div>
          <span className="kicker">Boundary</span>
          <h2>What a realistic reader should conclude</h2>
        </div>
        <div className="boundary-grid">
          <BoundaryItem
            title="Useful claim"
            body="You can demo whether privacy transformations preserve feature-attribution explanations on tabular tree models."
          />
          <BoundaryItem
            title="Not enough"
            body="The result does not prove the dataset is private against every attack or that the explanation is causally faithful."
          />
          <BoundaryItem
            title="Why engineers may care"
            body="It turns an academic notebook workflow into a repeatable API artifact with hashes and optional chain provenance."
          />
        </div>
      </section>

      <footer className="footer">
        <span>Colab is for reading the original notebooks; the demo path is the Space API.</span>
        <a href={colabUrl(dataset)} target="_blank" rel="noreferrer">
          <BookOpen />
          Matching Colab
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
    <div className="result-card">
      <SectionHead icon={<BadgeCheck />} label="Space response" title="What happened?" />
      <div className="result-summary">
        <strong>{result.privacy.method}</strong>
        <span>{result.comparison.plainEnglish}</span>
      </div>

      <div className="metric-grid">
        <Metric label={`Original ${metric}`} value={formatMetric(result.baseline.utility)} tone="plain" />
        <Metric
          label={`Private ${metric}`}
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

      <div className="feature-compare">
        <FeatureList title="Explanation before privacy" items={result.baseline.topFeatures} />
        <FeatureList title="Explanation after privacy" items={result.protected.topFeatures} />
      </div>

      <div className="artifact-grid">
        <ArtifactLine
          icon={<FileJson />}
          label="Dataset artifact"
          primary={`${result.dataset.rows.toLocaleString()} rows / ${result.dataset.features} features`}
          secondary={shortHash(result.dataset.hash)}
        />
        <ArtifactLine
          icon={<Terminal />}
          label="Manifest"
          primary={shortHash(result.manifest.manifestHash)}
          secondary={`${result.latencyMs.toLocaleString()} ms Space latency`}
        />
        <ArtifactLine
          icon={<BadgeCheck />}
          label="Result hash"
          primary={shortHash(result.resultHash)}
          secondary={result.schema}
        />
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
    <div className="request-card">
      <SectionHead icon={<Terminal />} label="Pending request" title="The JSON that will be sent" />
      <code>{JSON.stringify(payload, null, 2)}</code>
      <div className="readout">
        <span>When this comes back, look for two things:</span>
        <strong>Did utility stay high, and did SHAP still rank the same features?</strong>
      </div>
    </div>
  );
}

function StoryStep({
  icon,
  number,
  title,
  body
}: {
  icon: React.ReactNode;
  number: string;
  title: string;
  body: string;
}) {
  return (
    <article className="story-step">
      <div className="story-icon">{icon}</div>
      <span>{number}</span>
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}

function PrimerCard({
  icon,
  title,
  body
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <article className="primer-card">
      <div>{icon}</div>
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}

function BoundaryItem({ title, body }: { title: string; body: string }) {
  return (
    <article className="boundary-item">
      <strong>{title}</strong>
      <p>{body}</p>
    </article>
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

function EndpointLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="endpoint-line">
      <span>{label}</span>
      <code>{value}</code>
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

function ArtifactLine({
  icon,
  label,
  primary,
  secondary
}: {
  icon: React.ReactNode;
  label: string;
  primary: string;
  secondary: string;
}) {
  return (
    <div className="artifact-line">
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{primary}</strong>
      <code>{secondary}</code>
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
