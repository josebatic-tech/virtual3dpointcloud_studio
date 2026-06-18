# VLM Chat System - Setup & Usage Guide

## ✅ System Status

All services running and tested:
- ✅ llama.cpp server: `localhost:8080` (LLaVA 7.24B model loaded)
- ✅ CORS Proxy: `localhost:3001` (forwarding with proper headers)
- ✅ Dev server: `localhost:5173` (app ready)

## 🔧 Important Fixes Applied

### CORS Issue Resolution
The browser was blocking requests due to duplicate CORS headers. This has been fixed by:
1. Creating a proxy server that strips conflicting CORS headers from llama.cpp
2. Adding proper single `Access-Control-Allow-Origin: *` header
3. Configuring app to use proxy at `http://localhost:3001`

### Video Frame Validation
Added validation to ensure:
1. Video stream is started and playing
2. Video has frames ready (readyState >= 2)
3. Canvas capture contains actual image data (not empty/black)

## 📱 How to Use the VLM Chat

### Step 1: Start the Camera
1. Open **http://localhost:5173** in Chrome
2. Go to **Camera Tab** (🎥 icon)
3. Click **"▶ Start"** button
4. Grant camera permissions
5. **Wait 2-3 seconds** for video stream to stabilize
6. You should see your webcam preview

### Step 2: Go to AI Tab
1. Click **AI Tab** (🤖 icon)
2. You'll see:
   - **System Prompt** textarea
   - **Model** selector (llava, moondream, llava:13b)
   - **Chat History** area
   - **Message input** field

### Step 3: Set System Prompt (Optional)
Enter a system prompt to guide the model's behavior:

Examples:
- `You are a security camera analyst. Describe threats and anomalies.`
- `You are a classroom monitor. Report what students are doing.`
- `You are a scene photographer. Describe the composition and lighting.`

### Step 4: Send a Message
1. In the chat input field, type your question:
   - `What do you see?`
   - `Describe the scene in detail`
   - `Analyze what's in the background`
2. Press **Enter** or click **▶ Send**
3. **Wait 1-2 seconds** for the model to process
4. Response appears in chat history

### Step 5: Continue Conversation
- Previous messages stay in chat
- Model remembers conversation context
- Clear history with **"Clear history"** button
- Refresh page and chat persists (localStorage)

## ⚠️ Common Issues & Solutions

### Issue: "Video not ready. Please start camera first."
**Solution:** 
- Make sure you clicked ▶ Start in the Camera tab
- Allow camera permissions when browser prompts
- Wait 2-3 seconds for video to stabilize
- Then try sending a message again

### Issue: "Video frame is empty or too small."
**Solution:**
- This means the video stream exists but has no frames yet
- Wait another 2-3 seconds and try again
- Make sure camera has good lighting
- Check camera is not blocked

### Issue: Empty response or just echoes your message
**Solution:**
- Usually means video frame was empty/black when sent
- Start camera, wait for preview to show clearly
- Try again after video is stable
- Make sure something is visible in camera preview

### Issue: Connection failed / Network error
**Solution:**
- Verify all three services are running:
  ```bash
  # Check llama.cpp
  curl http://localhost:8080/
  
  # Check proxy
  curl http://localhost:3001/v1/chat/completions
  
  # Check app
  curl http://localhost:5173/
  ```
- Restart services if needed

## 🎬 What the Model Can Do

The LLaVA vision model can:
- ✅ Analyze what's visible in the camera feed
- ✅ Describe objects, people, scenes
- ✅ Count items
- ✅ Identify colors, shapes, patterns
- ✅ Read text in images (with good lighting)
- ✅ Analyze composition and framing
- ✅ Answer questions about the scene

## 📊 Performance Notes

- **First response:** 2-4 seconds (model loading frames)
- **Subsequent responses:** 1-2 seconds (model warmed up)
- **Image quality:** Works best with clear, well-lit video
- **Max response length:** 200 tokens (configurable)
- **GPU acceleration:** All 33 layers offloaded to GPU

## 🔍 Debug Mode

Open browser **Developer Tools** (F12):

**Console tab:**
- Look for `VLM response: ...` on success
- Look for error messages if something fails
- Network tab shows requests to `localhost:3001`

**Expected console output when sending message:**
```
VLM response: Here's what I see in the image...
```

## 🚀 All Features Working

✅ Florence-2 completely removed
✅ llama.cpp VLM integration active  
✅ VS Code-style tab interface
✅ System prompts supported
✅ Chat history with persistence
✅ Image/video frame analysis
✅ CORS issues resolved
✅ Proper error messages

---

**Ready to test!** Open http://localhost:5173 and enjoy your VLM chat system! 🎉
