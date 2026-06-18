import { VLM } from './constants.js';
import { getElem, mirrorFrame } from './utils.js';
import { DOM } from './constants.js';

let _isBusy = false;

export async function describeViaVLM(userPrompt, systemPrompt = '', history = []) {
  console.log('📸 describeViaVLM called:', { userPrompt, systemPrompt: systemPrompt?.substring(0, 30) });

  if (_isBusy) {
    console.warn('⚠️  Already processing, ignoring');
    return { content: '', error: 'Already processing' };
  }

  _isBusy = true;
  try {
    const video = getElem(DOM.VIDEO);
    if (!video || !video.videoWidth) {
      console.error('❌ No video element or width');
      return { content: '', error: 'No video stream' };
    }

    // Check if video is actually playing with frames
    if (video.paused || video.readyState < 2) {
      console.error('❌ Video not ready:', { paused: video.paused, readyState: video.readyState });
      return { content: '', error: 'Video not ready. Please start camera first.' };
    }

    // Resize canvas for faster processing - max 640px width
    let targetWidth = Math.min(video.videoWidth, VLM.MAX_IMAGE_SIZE);
    let targetHeight = Math.round((targetWidth / video.videoWidth) * video.videoHeight);

    const { canvas } = mirrorFrame(video, targetWidth, targetHeight);

    // Use lower quality to reduce payload size (0.6 = 60% quality)
    const imageB64 = canvas.toDataURL('image/jpeg', VLM.IMAGE_QUALITY).split(',')[1];

    // Validate we got image data
    if (!imageB64 || imageB64.length < 100) {
      console.error('❌ Image data too small:', imageB64?.length);
      return { content: '', error: 'Video frame is empty or too small. Try again in a moment.' };
    }
    console.log('✅ Image captured:', imageB64.length, 'bytes (optimized)');

    const messages = [];
    if (systemPrompt.trim()) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push(...history);
    // Use direct data URL format which llama.cpp/LLaVA handles correctly
    messages.push({
      role: 'user',
      content: `data:image/jpeg;base64,${imageB64}\n\n${userPrompt}`
    });

    const endpoint = `${VLM.ENDPOINT}/v1/chat/completions`;
    console.log('🌐 Calling API:', endpoint);
    console.log('   Model:', VLM.MODEL, '| Max tokens:', VLM.MAX_TOKENS);

    let response;
    try {
      console.log('⏳ Waiting for response...');
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors',
        body: JSON.stringify({
          model: VLM.MODEL,
          messages,
          max_tokens: VLM.MAX_TOKENS,
          temperature: VLM.TEMPERATURE
        })
      });
      console.log('📨 Response received:', response.status);
    } catch (corsError) {
      console.error('❌ CORS or network error:', corsError.message);
      return {
        content: '',
        error: `Connection failed. Is llama.cpp server running on ${VLM.ENDPOINT}?`
      };
    }

    if (!response.ok) {
      console.error('❌ Response not OK:', response.status);
      const errText = await response.text();
      console.error('   Error:', errText);
      return { content: '', error: `API error: ${response.statusText}` };
    }

    console.log('📖 Parsing JSON...');
    const data = await response.json();
    console.log('✅ JSON parsed:', data);
    const content = data.choices?.[0]?.message?.content?.trim() || '(no response)';
    console.log('🎯 VLM response:', content);
    return { content, error: null };
  } catch (e) {
    console.error('VLM describe error:', e);
    return { content: '', error: e.message };
  } finally {
    _isBusy = false;
  }
}
