# RealTime VLM Integration — Setup Guide

This website now supports two modes for describing scenes:
1. **Florence-2** (Mode A) — Fast, in-browser, no server needed
2. **RealTime VLM** (Mode B) — Richer descriptions, via Ollama API

## Setup for RealTime VLM Mode

### 1. Install Ollama
Download and install Ollama from https://ollama.ai

### 2. Pull a Vision Model
Open terminal and run:
```bash
ollama pull llava
```

Other vision models you can use:
- `ollava` (7B, fast)
- `llava:13b` (13B, better quality but slower)
- `llava-phi` (ultra-fast, smaller)
- `bakllava` (alternative, good quality)

### 3. Start Ollama with OpenAI-Compatible API
By default, Ollama serves on `localhost:11434` but doesn't expose the OpenAI-compatible endpoint. You need to start it with API mode:

**Option A — Using environment variable:**
```bash
OLLAMA_ORIGINS=* ollama serve
```

**Option B — Expose on all interfaces:**
```bash
OLLAMA_HOST=0.0.0.0:11434 OLLAMA_ORIGINS=* ollama serve
```

### 4. Verify the API is working
```bash
curl -X POST http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llava",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": false
  }'
```

You should get a JSON response.

### 5. Use the website
1. Open `http://localhost:8000` in your browser
2. Click **▶ Start** to enable the camera
3. In the "Describe" section, click the **RealTime VLM** button (top right of the section)
4. Click **◈ Describe Scene** to analyze the webcam feed

### Notes
- **CORS**: The website calls `http://localhost:11434/v1/chat/completions`. If you see CORS errors, make sure you started Ollama with `OLLAMA_ORIGINS=*`
- **Model choice**: Edit `describe.js` line 113 to change the model from `llava` to another vision model
- **Speed**: Vision models are slower than text models. Expect 2-5 seconds per description
- **Fallback**: If VLM mode fails, you can always switch back to Florence-2 (which requires a Hugging Face token but has no dependencies)

## Troubleshooting

**"RealTime VLM not responding"**
- Check that Ollama is running: `ollama list` in terminal
- Check CORS: start Ollama with `OLLAMA_ORIGINS=*`
- Check port: make sure `localhost:11434` is correct (or adjust in `describe.js`)

**"Model not found"**
- Verify the model is installed: `ollama list`
- Pull the model: `ollama pull llava`

**Slow responses**
- Vision inference is slower. For faster descriptions, use Florence-2 mode.
- Reduce image quality in `describe.js` (line 110: change `0.8` to lower value like `0.6`)

## Optional: Use with llama.cpp instead

If you prefer llama.cpp with a different GGUF file:
```bash
llama-server -m models/llava-v1.5-7b.gguf -ngl 99
```

Then update the API endpoint in `describe.js` from `localhost:11434` to `localhost:8000` (default llama-server port).
