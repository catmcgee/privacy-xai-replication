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
  GitCompareArrows,
  HelpCircle,
  Loader2,
  LockKeyhole,
  Radio,
  RefreshCcw,
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
const SPACE_DISPLAY = SPACE_URL || "local dev proxy";

const FALLBACK_DATASETS: DatasetInfo[] = [
  {
    id: "breast_cancer",
    label: "Breast Cancer Coimbra",
    task: "classification",
    description: "A small medical table: biomarkers in, cancer/control class out.",
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
      // The built-in list keeps the reading experience available if the Space is waking.
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
      <aside className="rail" aria-label="Reading path">
        <a className="wordmark" href="#top" aria-label="Privacy XAI home">
          <span>PX</span>
          <strong>Privacy XAI</strong>
        </a>
        <nav>
          <a href="#idea">The idea</a>
          <a href="#privacy">Privacy step</a>
          <a href="#explanations">Explanations</a>
          <a href="#lab">Run it</a>
          <a href="#read-result">Read result</a>
        </nav>
        <div className="rail-status">
          <StatusPill state={health} />
          <button type="button" onClick={() => void checkHealth()}>
            <RefreshCcw />
            Check backend
          </button>
        </div>
      </aside>

      <article className="article" id="top">
        <header className="intro" id="idea">
          <span className="eyebrow">A guided demo for software engineers</span>
          <h1>Can a model stay explainable after the user data is made private?</h1>
          <p className="lead">
            This is a practical walk-through of a privacy-preserving explainable AI
            paper. You will read the setup, run the hosted backend, and inspect whether
            privacy changed the model’s explanation.
          </p>
          <div className="plain-note">
            <HelpCircle />
            <span>
              This is about private rows in a dataset. It is not about hiding model
              weights, GPT-style mechanistic interpretability, or cryptographic proof of correctness.
            </span>
          </div>
        </header>

        <section className="terms" aria-label="Core terms">
          <Term
            icon={<Database />}
            title="Dataset"
            body="A table of individual records: biomarkers, risk-factor answers, or housing attributes."
          />
          <Term
            icon={<LockKeyhole />}
            title="Privacy transform"
            body="A preprocessing step that makes individual rows less exact before the model sees them."
          />
          <Term
            icon={<Sparkles />}
            title="Explanation"
            body="A SHAP feature ranking: which columns mattered most to a tree model’s predictions."
          />
        </section>

        <Section id="privacy" kicker="Step 1" title="First, blur the data without throwing it away.">
          <p>
            The paper asks a very practical question: if we protect the rows in a
            dataset, can we still train a useful model and explain it in roughly the
            same way?
          </p>
          <p>
            This demo includes two privacy transformations. <strong>MDAV</strong> groups
            nearby rows and replaces them with representative averages. <strong>Laplace
            noise</strong> adds random noise to numeric values. Both reduce the precision
            of individual records; both can damage the model if pushed too far.
          </p>
          <div className="method-explainer">
            <MiniMethod icon={<Shield />} title="MDAV / k-anonymity">
              Higher k means more rows share one representative. That usually helps
              privacy and increases distortion.
            </MiniMethod>
            <MiniMethod icon={<Waves />} title="Laplace noise">
              Higher scale means larger numeric perturbations. That usually makes rows
              harder to reconstruct and explanations less stable.
            </MiniMethod>
          </div>
        </Section>

        <Section id="explanations" kicker="Step 2" title="Then check whether the explanation survives.">
          <p>
            In this project, “interpretability” means feature attribution for tabular
            tree models. The backend trains a random forest on the original data, trains
            another on the protected data, and uses TreeSHAP to rank the features in
            both models.
          </p>
          <p>
            You are looking for a tradeoff. A strong result keeps utility high while
            keeping the protected model’s top features close to the original model’s
            top features.
          </p>
          <ol className="flow-list">
            <li>Train a baseline model on original rows.</li>
            <li>Transform the training rows with MDAV or Laplace noise.</li>
            <li>Train the protected-data model.</li>
            <li>Compare model utility and SHAP feature rankings.</li>
          </ol>
        </Section>

        <section className="lab-section" id="lab">
          <div className="lab-copy">
            <span className="eyebrow">Step 3 / do it</span>
            <h2>Run a small version of the paper workflow.</h2>
            <p>
              The public frontend sends one typed JSON request to a Hugging Face Space.
              The Space runs the experiment and returns a result artifact with hashes.
            </p>
            <BackendLine health={health} />
          </div>

          <div className="lab-grid">
            <div className="controls">
              <ControlHeader icon={<SlidersHorizontal />} title="Experiment request" />

              <div className="control-group">
                <span>Dataset</span>
                <div className="dataset-list">
                  {datasets.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      data-active={dataset === item.id}
                      onClick={() => setDataset(item.id)}
                    >
                      <strong>{item.label}</strong>
                      <small>
                        {item.task} / {item.sourceNote}
                      </small>
                    </button>
                  ))}
                </div>
                <p className="context-line">{datasetInfo.description}</p>
              </div>

              <div className="control-group">
                <span>Privacy method</span>
                <div className="method-list">
                  <button
                    type="button"
                    data-active={method === "mdav"}
                    onClick={() => setMethod("mdav")}
                  >
                    <Shield />
                    MDAV groups
                  </button>
                  <button
                    type="button"
                    data-active={method === "laplace"}
                    onClick={() => setMethod("laplace")}
                  >
                    <Waves />
                    Laplace noise
                  </button>
                </div>
              </div>

              {method === "mdav" ? (
                <Slider
                  label="k-anonymity"
                  value={k}
                  min={1}
                  max={20}
                  step={1}
                  onChange={setK}
                  explain="Higher k means more rows are averaged together."
                />
              ) : (
                <Slider
                  label="Noise scale"
                  value={noiseScale}
                  min={0.1}
                  max={12}
                  step={0.1}
                  onChange={setNoiseScale}
                  explain="Higher scale means more numeric perturbation."
                />
              )}
              <Slider
                label="Forest size"
                value={nEstimators}
                min={25}
                max={300}
                step={25}
                onChange={setNEstimators}
                explain="More trees can smooth noise but take longer."
              />

              <button className="run-button" type="button" onClick={() => void run()} disabled={busy}>
                {busy ? <Loader2 className="spin" /> : <FlaskConical />}
                {busy ? "Running..." : "Run on production Space"}
              </button>
              {error && <div className="error">{error}</div>}
            </div>

            <div className="artifact">
              {!result ? (
                <PendingRequest payload={runPayload} />
              ) : (
                <ResultView result={result} onDownload={downloadResult} />
              )}
            </div>
          </div>
        </section>

        <Section id="read-result" kicker="Step 4" title="How to read a result without knowing SHAP already.">
          <div className="metric-explainers">
            <MetricExplainer icon={<Activity />} title="Utility">
              Accuracy or R2. If this collapses, the privacy transform made the model
              much less useful.
            </MetricExplainer>
            <MetricExplainer icon={<GitCompareArrows />} title="Explanation similarity">
              Spearman rank correlation between the original SHAP feature ranking and
              the protected-data SHAP ranking. Higher is more similar.
            </MetricExplainer>
            <MetricExplainer icon={<Sigma />} title="Rank movement">
              Average feature-rank movement. Lower means the explanation changed less.
            </MetricExplainer>
            <MetricExplainer icon={<Anchor />} title="Provenance">
              Optional Solana devnet memo anchoring stores artifact hashes. It proves
              what result you showed, not that the ML conclusion is true.
            </MetricExplainer>
          </div>
        </Section>

        <footer className="footer">
          <span>Want the original notebooks?</span>
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
          {SPACE_URL && (
            <a href={SPACE_URL} target="_blank" rel="noreferrer">
              <ExternalLink />
              Space
            </a>
          )}
        </footer>
      </article>
    </main>
  );
}

function Section({
  id,
  kicker,
  title,
  children
}: {
  id: string;
  kicker: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="reading-section" id={id}>
      <span className="eyebrow">{kicker}</span>
      <h2>{title}</h2>
      <div className="section-body">{children}</div>
    </section>
  );
}

function Term({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="term">
      <div>{icon}</div>
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

function MiniMethod({
  icon,
  title,
  children
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mini-method">
      <div>{icon}</div>
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  );
}

function BackendLine({ health }: { health: "unchecked" | "ok" | "bad" }) {
  return (
    <div className="backend-line" data-state={health}>
      <Radio />
      <div>
        <strong>{health === "ok" ? "Production Space is reachable" : health === "bad" ? "Space is waking or unavailable" : "Space not checked yet"}</strong>
        <span>{SPACE_DISPLAY}</span>
      </div>
    </div>
  );
}

function ControlHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="control-header">
      <div>{icon}</div>
      <h3>{title}</h3>
    </div>
  );
}

function PendingRequest({ payload }: { payload: Record<string, unknown> }) {
  return (
    <div className="pending">
      <ControlHeader icon={<Terminal />} title="Request preview" />
      <pre>{JSON.stringify(payload, null, 2)}</pre>
      <p>
        Run the experiment to see utility, explanation similarity, top SHAP features,
        and artifact hashes.
      </p>
    </div>
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
      <ControlHeader icon={<BadgeCheck />} title="Result" />
      <p className="result-summary">{result.comparison.plainEnglish}</p>

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

      <div className="features-grid">
        <FeatureList title="Before privacy" items={result.baseline.topFeatures} />
        <FeatureList title="After privacy" items={result.protected.topFeatures} />
      </div>

      <div className="hashes">
        <HashLine icon={<Database />} label="Dataset" value={result.dataset.hash} />
        <HashLine icon={<FileJson />} label="Manifest" value={result.manifest.manifestHash} />
        <HashLine icon={<BadgeCheck />} label="Result" value={result.resultHash} />
      </div>

      <div className="actions">
        <button type="button" onClick={onDownload}>
          <ArrowDownToLine />
          Download JSON
        </button>
        <code>{anchorCommand}</code>
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

function MetricExplainer({
  icon,
  title,
  children
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="metric-explainer">
      <div>{icon}</div>
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  );
}

function FeatureList({ title, items }: { title: string; items: FeatureImportance[] }) {
  return (
    <div className="features">
      <h3>{title}</h3>
      {items.slice(0, 6).map((item) => (
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

function HashLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="hash-line">
      <div>{icon}</div>
      <span>{label}</span>
      <code>{shortHash(value)}</code>
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
