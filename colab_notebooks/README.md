# NOVA Google Colab live render backend

This notebook starts an ephemeral, authenticated SDXL render service on a Google Colab GPU. It is not a permanent server and it never falls back to CPU rendering or a placeholder image.

## Run

1. Open `nova_colab_render_backend.ipynb` in Google Colab.
2. Select **Runtime → Change runtime type → T4 GPU** (or another CUDA GPU).
3. Run cells 1–11 in order. Cell 11 verifies the authenticated tunnel health endpoint.
4. Run cell 12 to submit the included cafe prompt and wait for a newly generated image.
5. Copy the two values printed by cell 13 into the local ignored `.env`; never commit or paste the token into source or reports.
6. Start `python agent_runtime.py`, submit the cafe interior task, and validate the existing SSE/Viewer lifecycle.
7. Run cell 14 when finished to stop the API and tunnel.

The first model download is several gigabytes and the Cloudflare URL changes whenever the tunnel restarts. If Colab has no CUDA GPU, `/health` remains available with `available=false`, and `/render` returns an error instead of using CPU or an old image.

## Local `.env` template

```text
NOVA_RENDER_PROVIDER=colab
NOVA_COLAB_BASE_URL=<copy HTTPS URL from cell 13>
NOVA_COLAB_TOKEN=<copy temporary token from cell 13>
NOVA_COLAB_CONNECT_TIMEOUT_SECONDS=10
NOVA_COLAB_READ_TIMEOUT_SECONDS=60
NOVA_COLAB_POLL_INTERVAL_SECONDS=2
NOVA_COLAB_MAX_POLL_SECONDS=900
NOVA_COLAB_MAX_RESULT_BYTES=26214400
```

Model: `stabilityai/stable-diffusion-xl-base-1.0`, licensed under CreativeML Open RAIL++-M as documented by its official Hugging Face model card.
