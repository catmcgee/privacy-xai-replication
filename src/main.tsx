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
            body="A SHAP feature-attribution summary: which columns moved the tree model’s predictions the most."
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
            So “explain” has a narrow meaning here. It does not mean the app found
            the true causal reason, decoded the model’s internal algorithm, or did
            GPT-style circuit analysis. It means: for this trained model, SHAP estimated
            which input columns contributed most to its predictions, then the app checks
            whether that feature ranking still looks similar after the privacy step.
          </p>
          <ol className="flow-list">
            <li>Train a baseline model on original rows.</li>
            <li>Transform the training rows with MDAV or Laplace noise.</li>
            <li>Train the protected-data model.</li>
            <li>Compare model utility and SHAP feature rankings.</li>
          </ol>
        </Section>

        <Section id="standard" kicker="The standard" title="A useful privacy result has to pass two gates.">
          <p>
            The demo is not trying to prove that one explanation is philosophically
            “right.” It uses a practical XAI standard: the private-data model should
            still be useful, and its feature-attribution story should not drift too far
            from the original model’s story.
          </p>
          <div className="standard-list">
            <StandardItem marker="01" title="Utility gate">
              First ask whether the protected model still performs close to the
              baseline. If accuracy or R2 collapses, the model may have learned a
              different weaker task, so comparing explanations becomes less meaningful.
            </StandardItem>
            <StandardItem marker="02" title="Explanation gate">
              Then compare the SHAP rankings. High rank correlation means the same
              columns are important in roughly the same order. Low rank movement and
              low distortion mean the importance weights changed less.
            </StandardItem>
            <StandardItem marker="03" title="Privacy pressure">
              Raising k in MDAV or raising Laplace noise should make rows less exact,
              but it also makes the learning problem harder. Utility loss is not a UI
              bug; it is the tradeoff this paper is testing.
            </StandardItem>
            <StandardItem marker="04" title="Evidence boundary">
              Hashes and optional Solana anchoring make a result harder to rewrite
              after the fact. They do not prove that SHAP is the best explanation or
              that the experiment is statistically complete.
            </StandardItem>
          </div>
          <div className="utility-note">
            <HelpCircle />
            <span>
              If you see privacy preserve the top features but lose a lot of utility,
              that is a mixed result. The explanation may still look familiar, but it
              is attached to a less useful model.
            </span>
          </div>
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
                <ControlExplainer method={method} />
              </div>

              {method === "mdav" ? (
                <Slider
                  label="k-anonymity"
                  value={k}
                  min={1}
                  max={20}
                  step={1}
                  onChange={setK}
                  explain="Minimum crowd size before records are averaged. Higher k hides individuals more, but can wash out useful signal."
                />
              ) : (
                <Slider
                  label="Noise scale"
                  value={noiseScale}
                  min={0.1}
                  max={12}
                  step={0.1}
                  onChange={setNoiseScale}
                  explain="Amount of random numeric jitter added before training. Higher scale masks rows more, but can move the model and SHAP rankings."
                />
              )}
              <Slider
                label="Forest size"
                value={nEstimators}
                min={25}
                max={300}
                step={25}
                onChange={setNEstimators}
                explain="Number of trees in the random forest. This is not a privacy setting; more trees usually steadies the comparison but takes longer."
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
            <MetricExplainer icon={<Sparkles />} title="Explanation distortion">
              Normalized distance between the original and private SHAP importance
              weights. Closer to zero means less attribution drift.
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

function StandardItem({
  marker,
  title,
  children
}: {
  marker: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="standard-item">
      <span>{marker}</span>
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
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

function ControlExplainer({ method }: { method: Method }) {
  const methodDetail =
    method === "mdav"
      ? {
          label: "k-anonymity",
          text:
            "k is the minimum group size. At k=5, a protected row is represented by an average of five similar rows, so one exact person is harder to isolate."
        }
      : {
          label: "Noise scale",
          text:
            "Noise scale controls the size of random Laplace noise added to numeric columns before training. Larger values make rows less exact."
        };

  return (
    <div className="control-explainer" aria-label="Control explanations">
      <div>
        <strong>Privacy method</strong>
        <p>
          Choose how the training table is changed before the private model is trained.
          MDAV groups similar rows; Laplace keeps rows separate but perturbs their numbers.
        </p>
      </div>
      <div>
        <strong>{methodDetail.label}</strong>
        <p>{methodDetail.text}</p>
      </div>
      <div>
        <strong>Forest size</strong>
        <p>
          The number of decision trees. It can make utility and SHAP scores less noisy,
          but it does not add privacy by itself.
        </p>
      </div>
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
        <Metric
          label="Importance distortion"
          value={formatMetric(result.comparison.explanationDistortion)}
          tone={result.comparison.explanationDistortion <= 0.2 ? "good" : "warn"}
        />
      </div>

      <ResultMeaning result={result} />

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

function ResultMeaning({ result }: { result: ExperimentResult }) {
  const comparison = result.comparison;
  const metric = result.baseline.utilityMetric;
  const utilityClose = comparison.utilityDelta >= -0.03;
  const rankStable = comparison.rankCorrelation >= 0.65;
  const movementLow = comparison.irregularity < 2;
  const distortionLow = comparison.explanationDistortion <= 0.2;

  let headline = "Mixed interpretability result";
  let body =
    "The run preserved part of the explanation story, but at least one gate needs review.";

  if (utilityClose && rankStable && movementLow && distortionLow) {
    headline = "Strong privacy/XAI result";
    body =
      "The protected model stayed useful and the SHAP story stayed close to the baseline. This is the result the paper workflow is hoping to find.";
  } else if (!utilityClose && rankStable) {
    headline = "Feature story survived, utility did not";
    body =
      "The same columns still look important, but the protected model got worse. That makes the explanation comparison weaker because it is attached to a less capable model.";
  } else if (utilityClose && !rankStable) {
    headline = "Model still works, explanation drifted";
    body =
      "The protected model kept utility, but its feature ranking changed. This is useful evidence that the privacy transform affected what the model appears to rely on.";
  } else if (!utilityClose && !rankStable) {
    headline = "Privacy setting is probably too aggressive";
    body =
      "The protected model lost utility and the explanation moved. Try a smaller k, less noise, or more trees before treating this as a privacy-preserving explanation.";
  }

  return (
    <div className="result-meaning">
      <span>How to read this run</span>
      <strong>{headline}</strong>
      <p>{body}</p>
      <div className="meaning-checks">
        <MeaningCheck
          label="Utility"
          value={`${formatSignedMetric(comparison.utilityDelta)} ${metric}`}
          state={utilityClose ? "pass" : "review"}
        >
          Close means within about 0.03 of the baseline. Bigger losses mean the private
          training data changed the task too much.
        </MeaningCheck>
        <MeaningCheck
          label="Ranking"
          value={formatMetric(comparison.rankCorrelation)}
          state={rankStable ? "pass" : "review"}
        >
          Spearman correlation near 1 means the feature order stayed similar. Near 0
          means the explanation order is unstable.
        </MeaningCheck>
        <MeaningCheck
          label="Movement"
          value={formatMetric(comparison.irregularity)}
          state={movementLow && distortionLow ? "pass" : "review"}
        >
          Lower rank movement and lower attribution distortion mean the SHAP story
          changed less after privacy.
        </MeaningCheck>
      </div>
    </div>
  );
}

function MeaningCheck({
  label,
  value,
  state,
  children
}: {
  label: string;
  value: string;
  state: "pass" | "review";
  children: React.ReactNode;
}) {
  return (
    <div className="meaning-check" data-state={state}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{children}</p>
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

function formatSignedMetric(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  return `${value >= 0 ? "+" : ""}${value.toFixed(3)}`;
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
