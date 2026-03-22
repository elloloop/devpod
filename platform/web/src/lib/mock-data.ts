import type {
  WorkflowRun,
  Feature,
  PullRequest,
  ActivityItem,
  Artifact,
} from "./types";

export const mockWorkflowRuns: WorkflowRun[] = [
  {
    id: "run-001",
    workflow: "CI Pipeline",
    status: "completed",
    conclusion: "success",
    createdAt: "2026-03-21T14:30:00Z",
    updatedAt: "2026-03-21T14:45:00Z",
    trigger: { event: "push", ref: "refs/heads/main", sha: "a1b2c3d" },
    jobs: [
      {
        id: "job-001",
        name: "Build & Test",
        status: "completed",
        conclusion: "success",
        startedAt: "2026-03-21T14:30:15Z",
        completedAt: "2026-03-21T14:42:30Z",
        steps: [
          {
            name: "Checkout code",
            status: "completed",
            conclusion: "success",
            log: "Cloning repository...\nFetching refs/heads/main\nChecked out a1b2c3d",
          },
          {
            name: "Install dependencies",
            status: "completed",
            conclusion: "success",
            log: "npm ci\nadded 1247 packages in 28s\n\n142 packages are looking for funding\n  run `npm fund` for details",
          },
          {
            name: "Run linter",
            status: "completed",
            conclusion: "success",
            log: "Running ESLint...\n\n✓ No issues found\n\n247 files checked",
          },
          {
            name: "Run tests",
            status: "completed",
            conclusion: "success",
            log: "PASS src/lib/utils.test.ts\nPASS src/components/Button.test.tsx\nPASS src/hooks/useAuth.test.ts\nPASS src/api/features.test.ts\n\nTest Suites: 4 passed, 4 total\nTests:       23 passed, 23 total\nTime:        4.821s",
          },
          {
            name: "Build",
            status: "completed",
            conclusion: "success",
            log: "Creating optimized production build...\n\n✓ Compiled successfully\n\nRoute (app)           Size     First Load JS\n├ /                   5.2 kB   89 kB\n├ /features           3.1 kB   87 kB\n├ /prs                4.8 kB   88 kB\n└ /runs               3.6 kB   87 kB\n\n✓ Build completed in 12.4s",
          },
        ],
      },
      {
        id: "job-002",
        name: "Deploy Preview",
        status: "completed",
        conclusion: "success",
        startedAt: "2026-03-21T14:42:35Z",
        completedAt: "2026-03-21T14:45:00Z",
        steps: [
          {
            name: "Deploy to preview",
            status: "completed",
            conclusion: "success",
            log: "Deploying to preview environment...\nUpload complete\nPreview URL: https://preview-a1b2c3d.example.com\n\n✓ Deployment successful",
          },
        ],
      },
    ],
  },
  {
    id: "run-002",
    workflow: "Integration Tests",
    status: "completed",
    conclusion: "failure",
    createdAt: "2026-03-21T10:15:00Z",
    updatedAt: "2026-03-21T10:35:00Z",
    trigger: {
      event: "pull_request",
      ref: "refs/heads/feat/gpu-inference",
      sha: "e5f6g7h",
    },
    jobs: [
      {
        id: "job-003",
        name: "Integration Suite",
        status: "completed",
        conclusion: "failure",
        startedAt: "2026-03-21T10:15:30Z",
        completedAt: "2026-03-21T10:35:00Z",
        steps: [
          {
            name: "Setup environment",
            status: "completed",
            conclusion: "success",
            log: "Setting up test environment...\nPulling Docker images...\nStarting services...\n\n✓ Environment ready",
          },
          {
            name: "Run integration tests",
            status: "completed",
            conclusion: "failure",
            log: 'PASS tests/api/auth.test.ts\nPASS tests/api/features.test.ts\nFAIL tests/api/inference.test.ts\n  ● GPU inference endpoint › should return embeddings\n    Expected: 768 dimensions\n    Received: undefined\n\n    Error: Connection refused at localhost:8080\n      at Object.<anonymous> (tests/api/inference.test.ts:42:5)\n\nTest Suites: 1 failed, 2 passed, 3 total\nTests:       1 failed, 11 passed, 12 total\nTime:        18.234s',
          },
        ],
      },
    ],
  },
  {
    id: "run-003",
    workflow: "CI Pipeline",
    status: "in_progress",
    createdAt: "2026-03-22T08:00:00Z",
    updatedAt: "2026-03-22T08:05:00Z",
    trigger: {
      event: "push",
      ref: "refs/heads/feat/embeddings-api",
      sha: "i9j0k1l",
    },
    jobs: [
      {
        id: "job-004",
        name: "Build & Test",
        status: "in_progress",
        startedAt: "2026-03-22T08:00:15Z",
        steps: [
          {
            name: "Checkout code",
            status: "completed",
            conclusion: "success",
            log: "Cloning repository...\nChecked out i9j0k1l",
          },
          {
            name: "Install dependencies",
            status: "completed",
            conclusion: "success",
            log: "npm ci\nadded 1247 packages in 26s",
          },
          {
            name: "Run linter",
            status: "in_progress",
            log: "Running ESLint...\nChecking files...",
          },
          {
            name: "Run tests",
            status: "queued",
            log: "",
          },
          {
            name: "Build",
            status: "queued",
            log: "",
          },
        ],
      },
    ],
  },
  {
    id: "run-004",
    workflow: "Deploy Production",
    status: "completed",
    conclusion: "success",
    createdAt: "2026-03-20T16:00:00Z",
    updatedAt: "2026-03-20T16:12:00Z",
    trigger: { event: "push", ref: "refs/heads/main", sha: "m2n3o4p" },
    jobs: [
      {
        id: "job-005",
        name: "Deploy",
        status: "completed",
        conclusion: "success",
        startedAt: "2026-03-20T16:00:10Z",
        completedAt: "2026-03-20T16:12:00Z",
        steps: [
          {
            name: "Build image",
            status: "completed",
            conclusion: "success",
            log: "Building Docker image...\nStep 1/12 : FROM node:20-alpine\nStep 2/12 : WORKDIR /app\n...\nSuccessfully built abc123def\nSuccessfully tagged devpod/platform:latest",
          },
          {
            name: "Push to registry",
            status: "completed",
            conclusion: "success",
            log: "Pushing devpod/platform:latest...\nsha256:abc123def: Pushed\nlatest: digest: sha256:abc123def size: 3048",
          },
          {
            name: "Rolling deploy",
            status: "completed",
            conclusion: "success",
            log: "Updating deployment...\nWaiting for rollout...\ndeployment \"platform\" successfully rolled out\n\n✓ Production deployment complete",
          },
        ],
      },
    ],
  },
  {
    id: "run-005",
    workflow: "Nightly Data Sync",
    status: "completed",
    conclusion: "success",
    createdAt: "2026-03-22T02:00:00Z",
    updatedAt: "2026-03-22T02:15:00Z",
    trigger: { event: "schedule", ref: "refs/heads/main", sha: "q5r6s7t" },
    jobs: [
      {
        id: "job-006",
        name: "Sync Data",
        status: "completed",
        conclusion: "success",
        startedAt: "2026-03-22T02:00:05Z",
        completedAt: "2026-03-22T02:15:00Z",
        steps: [
          {
            name: "Fetch upstream data",
            status: "completed",
            conclusion: "success",
            log: "Fetching data from upstream sources...\nDownloaded 2.4 GB in 180s\n\n✓ Data fetch complete",
          },
          {
            name: "Transform and validate",
            status: "completed",
            conclusion: "success",
            log: "Running transformations...\nValidating 1,247,832 records...\n0 validation errors\n\n✓ All records valid",
          },
          {
            name: "Upload to storage",
            status: "completed",
            conclusion: "success",
            log: "Uploading to object storage...\nUploaded 2.4 GB\n\n✓ Sync complete",
          },
        ],
      },
    ],
  },
  {
    id: "run-006",
    workflow: "CI Pipeline",
    status: "queued",
    createdAt: "2026-03-22T09:00:00Z",
    updatedAt: "2026-03-22T09:00:00Z",
    trigger: {
      event: "pull_request",
      ref: "refs/heads/fix/auth-token-refresh",
      sha: "u8v9w0x",
    },
    jobs: [
      {
        id: "job-007",
        name: "Build & Test",
        status: "queued",
        steps: [
          { name: "Checkout code", status: "queued", log: "" },
          { name: "Install dependencies", status: "queued", log: "" },
          { name: "Run linter", status: "queued", log: "" },
          { name: "Run tests", status: "queued", log: "" },
          { name: "Build", status: "queued", log: "" },
        ],
      },
    ],
  },
];

export const mockFeatures: Feature[] = [
  {
    slug: "gpu-inference-engine",
    title: "GPU Inference Engine",
    description:
      "High-performance GPU-accelerated inference engine supporting multiple model architectures including transformer-based LLMs. Includes automatic batching, dynamic memory management, and quantization support for optimal throughput on RunPod infrastructure.",
    date: "2026-03-18",
    status: "shipped",
    video: "/videos/gpu-inference-demo.mp4",
    screenshots: [
      "/screenshots/inference-dashboard.png",
      "/screenshots/inference-metrics.png",
      "/screenshots/inference-config.png",
    ],
    prs: [
      {
        number: 42,
        title: "Add GPU inference engine core",
        repo: "devpod",
        status: "merged",
      },
      {
        number: 45,
        title: "Add batching support for inference",
        repo: "devpod",
        status: "merged",
      },
      {
        number: 48,
        title: "Add quantization support (INT8/FP16)",
        repo: "devpod",
        status: "merged",
      },
    ],
  },
  {
    slug: "embeddings-api",
    title: "Embeddings API",
    description:
      "REST API for generating vector embeddings from text and code using GPU-accelerated models. Supports batch processing, multiple embedding models, and automatic dimensionality selection. Integrates with the existing inference engine for shared GPU resource management.",
    date: "2026-03-21",
    status: "review",
    video: "/videos/embeddings-demo.mp4",
    screenshots: [
      "/screenshots/embeddings-playground.png",
      "/screenshots/embeddings-docs.png",
    ],
    prs: [
      {
        number: 51,
        title: "Add embeddings API endpoint",
        repo: "devpod",
        status: "open",
      },
      {
        number: 53,
        title: "Add batch embedding support",
        repo: "devpod",
        status: "open",
      },
    ],
  },
  {
    slug: "synthetic-data-pipeline",
    title: "Synthetic Data Generation Pipeline",
    description:
      "End-to-end pipeline for generating high-quality synthetic training data using LLMs. Includes configurable generation templates, quality scoring, deduplication, and export in multiple formats (JSONL, Parquet, HuggingFace datasets).",
    date: "2026-03-22",
    status: "in-progress",
    screenshots: ["/screenshots/datagen-config.png"],
    prs: [
      {
        number: 55,
        title: "Add synthetic data generation skill",
        repo: "devpod",
        status: "open",
      },
    ],
  },
  {
    slug: "workflow-runner",
    title: "Local Workflow Runner",
    description:
      "GitHub Actions-compatible workflow runner that executes CI/CD pipelines locally. Supports Docker-based job execution, artifact management, and real-time log streaming via Server-Sent Events.",
    date: "2026-03-15",
    status: "shipped",
    video: "/videos/runner-demo.mp4",
    screenshots: [
      "/screenshots/runner-logs.png",
      "/screenshots/runner-artifacts.png",
      "/screenshots/runner-config.png",
    ],
    prs: [
      {
        number: 30,
        title: "Add local workflow runner",
        repo: "devpod",
        status: "merged",
      },
      {
        number: 33,
        title: "Add SSE log streaming",
        repo: "devpod",
        status: "merged",
      },
      {
        number: 36,
        title: "Add artifact upload/download",
        repo: "devpod",
        status: "merged",
      },
    ],
  },
  {
    slug: "auth-rbac",
    title: "Authentication & RBAC",
    description:
      "Token-based authentication system with role-based access control. Supports API keys, JWT tokens, and granular permissions for managing access to inference endpoints, data pipelines, and administrative functions.",
    date: "2026-03-12",
    status: "shipped",
    screenshots: [
      "/screenshots/auth-login.png",
      "/screenshots/auth-roles.png",
    ],
    prs: [
      {
        number: 22,
        title: "Add JWT authentication",
        repo: "devpod",
        status: "merged",
      },
      {
        number: 25,
        title: "Add role-based access control",
        repo: "devpod",
        status: "merged",
      },
    ],
  },
];

export const mockPullRequests: PullRequest[] = [
  {
    number: 55,
    title: "Add synthetic data generation skill",
    description:
      "Adds a new Claude Code skill for generating synthetic training data using LLMs. Includes configurable templates, quality scoring, and multi-format export.\n\n## Changes\n- New `datagen` skill with generation templates\n- Quality scoring pipeline using embedding similarity\n- Export support for JSONL, Parquet, HuggingFace formats\n- Unit tests and integration tests",
    branch: "feat/synthetic-datagen",
    baseBranch: "main",
    author: "arun",
    status: "open",
    feature: "synthetic-data-pipeline",
    createdAt: "2026-03-22T07:30:00Z",
    checks: [mockWorkflowRuns[2]],
    diff: `--- a/skills/datagen/index.ts
+++ b/skills/datagen/index.ts
@@ -0,0 +1,45 @@
+import { Skill } from '../types';
+import { generateBatch } from './generator';
+import { scoreSamples } from './scorer';
+import { exportDataset } from './exporter';
+
+export const datagen: Skill = {
+  name: 'datagen',
+  description: 'Generate synthetic training data',
+
+  async execute(config) {
+    const { template, count, model, format } = config;
+
+    console.log(\`Generating \${count} samples using \${model}...\`);
+
+    // Generate samples in batches
+    const batchSize = 50;
+    const samples = [];
+
+    for (let i = 0; i < count; i += batchSize) {
+      const batch = await generateBatch({
+        template,
+        count: Math.min(batchSize, count - i),
+        model,
+      });
+      samples.push(...batch);
+    }
+
+    // Score and filter
+    const scored = await scoreSamples(samples);
+    const filtered = scored.filter(s => s.score >= 0.7);
+
+    console.log(\`Generated \${samples.length} samples, \${filtered.length} passed quality filter\`);
+
+    // Export
+    const output = await exportDataset(filtered, format);
+
+    return {
+      totalGenerated: samples.length,
+      totalPassed: filtered.length,
+      outputPath: output.path,
+      format,
+    };
+  },
+};
--- a/skills/datagen/generator.ts
+++ b/skills/datagen/generator.ts
@@ -0,0 +1,32 @@
+interface GenerateConfig {
+  template: string;
+  count: number;
+  model: string;
+}
+
+interface Sample {
+  id: string;
+  input: string;
+  output: string;
+  metadata: Record<string, unknown>;
+}
+
+export async function generateBatch(config: GenerateConfig): Promise<Sample[]> {
+  const { template, count, model } = config;
+
+  const response = await fetch('http://localhost:8080/v1/completions', {
+    method: 'POST',
+    headers: { 'Content-Type': 'application/json' },
+    body: JSON.stringify({
+      model,
+      prompt: template,
+      n: count,
+      temperature: 0.9,
+    }),
+  });
+
+  const data = await response.json();
+  return data.choices.map((choice: any, i: number) => ({
+    id: \`sample-\${Date.now()}-\${i}\`,
+    input: template,
+    output: choice.text,
+    metadata: { model, temperature: 0.9 },
+  }));
+}`,
    files: [
      { path: "skills/datagen/index.ts", additions: 45, deletions: 0 },
      { path: "skills/datagen/generator.ts", additions: 32, deletions: 0 },
      { path: "skills/datagen/scorer.ts", additions: 28, deletions: 0 },
      { path: "skills/datagen/exporter.ts", additions: 41, deletions: 0 },
      { path: "skills/datagen/tests/datagen.test.ts", additions: 67, deletions: 0 },
    ],
  },
  {
    number: 53,
    title: "Add batch embedding support",
    description:
      "Adds batch processing support to the embeddings API, allowing multiple texts to be embedded in a single request for improved throughput.\n\n## Changes\n- Batch endpoint at `/v1/embeddings/batch`\n- Configurable batch size limits\n- Progress tracking for large batches\n- Updated API documentation",
    branch: "feat/batch-embeddings",
    baseBranch: "main",
    author: "arun",
    status: "open",
    feature: "embeddings-api",
    createdAt: "2026-03-21T15:00:00Z",
    checks: [mockWorkflowRuns[1]],
    diff: `--- a/api/embeddings/batch.ts
+++ b/api/embeddings/batch.ts
@@ -0,0 +1,38 @@
+import { EmbeddingModel } from './model';
+import { validateInput } from './validation';
+
+interface BatchRequest {
+  texts: string[];
+  model?: string;
+  dimensions?: number;
+}
+
+interface BatchResponse {
+  embeddings: number[][];
+  model: string;
+  usage: { totalTokens: number };
+}
+
+export async function handleBatchEmbeddings(
+  req: BatchRequest
+): Promise<BatchResponse> {
+  const { texts, model = 'all-MiniLM-L6-v2', dimensions } = req;
+
+  // Validate all inputs
+  for (const text of texts) {
+    validateInput(text);
+  }
+
+  const embeddingModel = new EmbeddingModel(model);
+
+  // Process in sub-batches for memory efficiency
+  const subBatchSize = 32;
+  const allEmbeddings: number[][] = [];
+  let totalTokens = 0;
+
+  for (let i = 0; i < texts.length; i += subBatchSize) {
+    const batch = texts.slice(i, i + subBatchSize);
+    const result = await embeddingModel.embed(batch, { dimensions });
+    allEmbeddings.push(...result.embeddings);
+    totalTokens += result.usage.totalTokens;
+  }
+
+  return { embeddings: allEmbeddings, model, usage: { totalTokens } };
+}`,
    files: [
      { path: "api/embeddings/batch.ts", additions: 38, deletions: 0 },
      { path: "api/embeddings/validation.ts", additions: 12, deletions: 3 },
      { path: "tests/embeddings-batch.test.ts", additions: 54, deletions: 0 },
    ],
  },
  {
    number: 51,
    title: "Add embeddings API endpoint",
    description:
      "Adds the core embeddings API endpoint for generating vector embeddings from text using GPU-accelerated models.\n\n## Changes\n- New `/v1/embeddings` endpoint\n- Support for multiple embedding models\n- GPU memory management integration\n- OpenAI-compatible response format",
    branch: "feat/embeddings-api",
    baseBranch: "main",
    author: "arun",
    status: "open",
    feature: "embeddings-api",
    createdAt: "2026-03-20T11:00:00Z",
    checks: [mockWorkflowRuns[0]],
    diff: `--- a/api/embeddings/index.ts
+++ b/api/embeddings/index.ts
@@ -0,0 +1,42 @@
+import { Router } from 'express';
+import { EmbeddingModel } from './model';
+import { validateInput } from './validation';
+
+const router = Router();
+
+router.post('/v1/embeddings', async (req, res) => {
+  try {
+    const { input, model = 'all-MiniLM-L6-v2', dimensions } = req.body;
+
+    validateInput(input);
+
+    const embeddingModel = new EmbeddingModel(model);
+    const result = await embeddingModel.embed(
+      Array.isArray(input) ? input : [input],
+      { dimensions }
+    );
+
+    res.json({
+      object: 'list',
+      data: result.embeddings.map((embedding, i) => ({
+        object: 'embedding',
+        embedding,
+        index: i,
+      })),
+      model,
+      usage: result.usage,
+    });
+  } catch (error) {
+    res.status(400).json({
+      error: {
+        message: error instanceof Error ? error.message : 'Unknown error',
+        type: 'invalid_request_error',
+      },
+    });
+  }
+});
+
+export default router;`,
    files: [
      { path: "api/embeddings/index.ts", additions: 42, deletions: 0 },
      { path: "api/embeddings/model.ts", additions: 85, deletions: 0 },
      { path: "api/embeddings/validation.ts", additions: 18, deletions: 0 },
    ],
  },
  {
    number: 48,
    title: "Add quantization support (INT8/FP16)",
    description:
      "Adds model quantization support for the GPU inference engine, enabling INT8 and FP16 modes for reduced memory usage and improved throughput.",
    branch: "feat/quantization",
    baseBranch: "main",
    author: "arun",
    status: "merged",
    feature: "gpu-inference-engine",
    createdAt: "2026-03-17T09:00:00Z",
    checks: [
      {
        ...mockWorkflowRuns[0],
        id: "run-010",
        createdAt: "2026-03-17T09:05:00Z",
      },
    ],
    diff: `--- a/inference/quantize.ts
+++ b/inference/quantize.ts
@@ -0,0 +1,28 @@
+export type QuantizationMode = 'fp32' | 'fp16' | 'int8';
+
+export function quantizeWeights(
+  weights: Float32Array,
+  mode: QuantizationMode
+): ArrayBuffer {
+  switch (mode) {
+    case 'fp16':
+      return convertToFloat16(weights);
+    case 'int8':
+      return convertToInt8(weights);
+    default:
+      return weights.buffer;
+  }
+}`,
    files: [
      { path: "inference/quantize.ts", additions: 28, deletions: 0 },
      { path: "inference/engine.ts", additions: 15, deletions: 4 },
      { path: "tests/quantize.test.ts", additions: 42, deletions: 0 },
    ],
  },
  {
    number: 45,
    title: "Add batching support for inference",
    description:
      "Implements automatic request batching for the inference engine to maximize GPU utilization. Supports configurable batch sizes and timeout-based flushing.",
    branch: "feat/inference-batching",
    baseBranch: "main",
    author: "arun",
    status: "merged",
    feature: "gpu-inference-engine",
    createdAt: "2026-03-16T14:00:00Z",
    checks: [
      {
        ...mockWorkflowRuns[0],
        id: "run-011",
        createdAt: "2026-03-16T14:05:00Z",
      },
    ],
    diff: `--- a/inference/batcher.ts
+++ b/inference/batcher.ts
@@ -0,0 +1,15 @@
+export class RequestBatcher {
+  private queue: Request[] = [];
+  private timer: NodeJS.Timeout | null = null;
+
+  constructor(
+    private maxBatchSize: number = 32,
+    private flushTimeout: number = 50
+  ) {}
+
+  async add(request: Request): Promise<Response> {
+    // ... batching logic
+  }
+}`,
    files: [
      { path: "inference/batcher.ts", additions: 68, deletions: 0 },
      { path: "inference/engine.ts", additions: 22, deletions: 8 },
    ],
  },
  {
    number: 42,
    title: "Add GPU inference engine core",
    description:
      "Adds the core GPU inference engine with support for transformer-based model loading, tokenization, and inference execution.",
    branch: "feat/gpu-inference",
    baseBranch: "main",
    author: "arun",
    status: "merged",
    feature: "gpu-inference-engine",
    createdAt: "2026-03-14T10:00:00Z",
    checks: [
      {
        ...mockWorkflowRuns[0],
        id: "run-012",
        createdAt: "2026-03-14T10:05:00Z",
      },
    ],
    diff: `--- a/inference/engine.ts
+++ b/inference/engine.ts
@@ -0,0 +1,20 @@
+export class InferenceEngine {
+  private model: any;
+
+  async loadModel(path: string): Promise<void> {
+    // Load model weights and config
+  }
+
+  async infer(input: string): Promise<string> {
+    // Run inference
+    return '';
+  }
+}`,
    files: [
      { path: "inference/engine.ts", additions: 120, deletions: 0 },
      { path: "inference/tokenizer.ts", additions: 85, deletions: 0 },
      { path: "inference/config.ts", additions: 32, deletions: 0 },
    ],
  },
];

export const mockArtifacts: Record<string, Artifact[]> = {
  "run-001": [
    {
      id: "art-001",
      name: "build-output.tar.gz",
      path: "artifacts/build-output.tar.gz",
      size: 15728640,
      mimeType: "application/gzip",
    },
    {
      id: "art-002",
      name: "test-report.html",
      path: "artifacts/test-report.html",
      size: 245760,
      mimeType: "text/html",
    },
    {
      id: "art-003",
      name: "coverage-report.json",
      path: "artifacts/coverage-report.json",
      size: 102400,
      mimeType: "application/json",
    },
  ],
  "run-004": [
    {
      id: "art-004",
      name: "docker-image-manifest.json",
      path: "artifacts/docker-image-manifest.json",
      size: 4096,
      mimeType: "application/json",
    },
  ],
};

export const mockActivity: ActivityItem[] = [
  {
    id: "act-1",
    type: "run",
    title: "CI Pipeline started",
    description: "Push to feat/embeddings-api triggered CI Pipeline",
    status: "in_progress",
    date: "2026-03-22T08:00:00Z",
    link: "/runs/run-003",
  },
  {
    id: "act-2",
    type: "pr",
    title: "PR #55 opened",
    description: "Add synthetic data generation skill",
    status: "open",
    date: "2026-03-22T07:30:00Z",
    link: "/prs/55",
  },
  {
    id: "act-3",
    type: "feature",
    title: "Embeddings API moved to review",
    description: "Embeddings API is now in review status",
    status: "review",
    date: "2026-03-21T15:00:00Z",
    link: "/features/embeddings-api",
  },
  {
    id: "act-4",
    type: "run",
    title: "Integration Tests failed",
    description: "Tests failed for feat/gpu-inference",
    status: "failed",
    date: "2026-03-21T10:35:00Z",
    link: "/runs/run-002",
  },
  {
    id: "act-5",
    type: "run",
    title: "CI Pipeline completed",
    description: "All checks passed for push to main",
    status: "completed",
    date: "2026-03-21T14:45:00Z",
    link: "/runs/run-001",
  },
  {
    id: "act-6",
    type: "feature",
    title: "GPU Inference Engine shipped",
    description: "GPU Inference Engine is now marked as shipped",
    status: "shipped",
    date: "2026-03-18T12:00:00Z",
    link: "/features/gpu-inference-engine",
  },
  {
    id: "act-7",
    type: "pr",
    title: "PR #48 merged",
    description: "Add quantization support (INT8/FP16)",
    status: "merged",
    date: "2026-03-17T18:00:00Z",
    link: "/prs/48",
  },
  {
    id: "act-8",
    type: "run",
    title: "Deploy Production completed",
    description: "Production deployment successful",
    status: "completed",
    date: "2026-03-20T16:12:00Z",
    link: "/runs/run-004",
  },
];
