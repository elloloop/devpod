# Embed — Generate Embeddings on RunPod GPU

Generate semantic embeddings for a dataset using a GPU-accelerated model on RunPod. Pulls source data from R2, encodes with a HuggingFace model, writes Arrow output, pushes back to R2, and optionally deploys to production.

## Arguments

- `--source`: R2 key or local path to source data (JSONL or gzipped JSONL)
- `--model`: HuggingFace model name (default: project-specific)
- `--output`: R2 key for output Arrow file
- `--deploy`: If set, also deploys to production instance

## Prerequisites

- RunPod API key in environment (`RUNPOD_API_KEY`)
- R2 credentials configured (endpoint, access key, secret key, bucket)
- A `scripts/build_embedding_text.py` or equivalent in the project that defines how source records map to embedding text
- SSH access to production instance (for deploy step)

## How It Works

### 1. Prepare the embedding script

The project must have a script that:
- Pulls source data from R2 (gzipped JSONL)
- Builds embedding text per record (project-specific logic)
- Loads the embedding model via `sentence-transformers`
- Encodes all records in batches on GPU
- Writes an Arrow IPC file with records + embeddings
- Pushes the Arrow file to R2

Key design principles for embedding text:
- **Plot/description FIRST** — this carries the most semantic weight
- **Themes/keywords SECOND** — enables thematic search
- **Structured metadata MIDDLE** — genres, director, cast
- **Title LAST** — prevents title-matching from dominating semantic search
- **Language only if non-English** — avoids noise

### 2. Launch RunPod instance

Use the devpod inference image (`ghcr.io/elloloop/devpod:inference`) which has:
- CUDA 12.4 + PyTorch
- sentence-transformers, transformers, vLLM
- All dependencies pre-installed

```bash
# Launch via RunPod API or dashboard
# GPU: RTX 4090 or A100 (24-80GB VRAM)
# Container: ghcr.io/elloloop/devpod:inference
```

### 3. Run embedding generation

SSH into RunPod, clone/copy the script, and run:

```bash
python generate_embeddings.py \
  --r2-endpoint $R2_ENDPOINT \
  --r2-key $R2_ACCESS_KEY \
  --r2-secret $R2_SECRET_KEY \
  --r2-bucket $R2_BUCKET \
  --source enriched/movies_enriched.jsonl.gz \
  --model Alibaba-NLP/gte-Qwen2-1.5B-instruct \
  --output embeddings/content.arrow \
  --batch-size 512
```

Expected performance:
- 550K records on RTX 4090: ~5-10 minutes
- 550K records on A100: ~3-5 minutes

### 4. Deploy to production

After Arrow is in R2:

```bash
# On production instance
aws s3 cp s3://crawler-data/embeddings/content.arrow /opt/streammind/data/content.arrow \
  --endpoint-url $R2_ENDPOINT

# Restart the service
sudo systemctl restart streammind
```

## Quality Checks

Before deploying:
1. Verify record count matches source (`pyarrow.ipc.open_file(...).num_rows`)
2. Spot-check embedding dimensions match model output
3. Run a few test queries against the new Arrow file locally
4. Verify no NaN/zero embeddings

## Important

- ALWAYS use normalized embeddings (L2 norm = 1) for cosine similarity search
- The Arrow schema must match what the recommendation service expects
- Embedding text construction is PROJECT-SPECIFIC — the model and pipeline are generic
- Keep the Arrow file under 2GB for fast loading (LZ4 compression helps)
- If the model requires `trust_remote_code=True`, verify the code before running on production data
