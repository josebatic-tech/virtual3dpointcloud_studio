# RealTime-VLM Integration for Depth Point Cloud

Your website now supports real-time scene description with two modes:

## Quick Setup (5 minutes)

### 1. Install Ollama
- Download: https://ollama.ai
- Install and run

### 2. Pull a vision model
```bash
ollama pull llava
```

### 3. Start Ollama with OpenAI API
```bash
# macOS/Linux
OLLAMA_ORIGINS=* ollama serve

# Windows (in cmd or PowerShell)
set OLLAMA_ORIGINS=*
ollama serve
```

### 4. Run the website
```bash
python serve.py 8000
# Then open http://localhost:8000
```

### 5. Use it
- Click **▶ Start** to enable camera
- Click **Depth** to estimate depth
- In the "Describe" section, click **RealTime VLM** (it's a button at the top)
- Click **◈ Describe Scene** to analyze the webcam

## Mode Comparison

| Feature | Florence-2 | RealTime-VLM |
|---------|-----------|----------------|
| **Speed** | 2-3s | 3-5s |
| **Quality** | Good | Excellent |
| **Server** | None (in-browser) | Ollama local |
| **Token needed** | Hugging Face | None |
| **Customizable** | No | Yes (choose model) |

## Choose Your Vision Model

**Fast (for real-time):**
```bash
ollama pull llava-phi      # 2.7B, ultra-fast
ollama pull moondream      # 1.6B, very basic
```

**Balanced:**
```bash
ollama pull llava          # 7B, good quality (default)
ollama pull bakllava       # 7B, alternative
```

**High quality (but slower):**
```bash
ollama pull llava:13b      # 13B, excellent descriptions
```

Then edit `files/js/describe.js` line 134 to use it:
```javascript
model: 'llava:13b'
```

## Troubleshooting

**"VLM not responding" or CORS error**
- Make sure Ollama is running: `ollama list` in terminal
- Make sure CORS is enabled: start with `OLLAMA_ORIGINS=*`

**Model not found**
- Verify model is installed: `ollama list`
- Pull it: `ollama pull <model-name>`

**Slow responses**
- Vision inference is slow. Try llava-phi or moondream for speed.
- Or reduce JPEG quality in `describe.js` line 126: change `0.8` to `0.6`

**Browser blocks localhost API**
- Make sure you're accessing `http://` not `https://`
- Check browser console (F12 > Console) for error messages

## API Details

The VLM API call uses Ollama's OpenAI-compatible endpoint:

```
POST http://localhost:11434/v1/chat/completions
```

It sends the current webcam frame as a base64 JPEG and gets a text description back.

## Switching Modes

In the "Describe" section of the sidebar:
- **Florence-2 button** → fast, in-browser, requires HF token
- **RealTime VLM button** → richer, requires Ollama, no token

Click either button to switch, then click **◈ Describe Scene**.

---

See `REALTIME_VLM_SETUP.md` for advanced setup options.
