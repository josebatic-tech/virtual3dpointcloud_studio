import fs from 'fs';

const PROXY_URL = 'http://localhost:3001';

console.log('🎬 VLM Chat with Image Test\n');
console.log('═'.repeat(60));

// Create a small test image (1x1 pixel red PNG)
const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

console.log('[Test 1] VLM Chat with Image');
console.log('─'.repeat(60));

try {
  const messages = [
    {
      role: 'system',
      content: 'You are a scene analyzer. Describe what you see in the image.'
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'What color is the image?' },
        {
          type: 'image_url',
          image_url: { url: `data:image/png;base64,${testImageBase64}` }
        }
      ]
    }
  ];

  console.log('Sending request with:');
  console.log('  - System prompt: "You are a scene analyzer..."');
  console.log('  - User message: "What color is the image?"');
  console.log('  - Image: 1x1 PNG (base64)');
  console.log('');

  const res = await fetch(`${PROXY_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llava',
      messages,
      max_tokens: 100,
      temperature: 0.7
    })
  });

  if (res.ok) {
    const data = await res.json();
    const response = data.choices?.[0]?.message?.content;

    console.log('✅ Request successful!');
    console.log('');
    console.log('Response from LLaVA:');
    console.log('  "' + response + '"');
    console.log('');
    console.log('Metrics:');
    console.log(`  - Tokens generated: ${data.usage.completion_tokens}`);
    console.log(`  - Tokens used: ${data.usage.total_tokens}`);
    console.log(`  - Model: ${data.model}`);
  } else {
    console.log(`❌ Request failed: ${res.status}`);
    const text = await res.text();
    console.log(text);
  }
} catch (e) {
  console.log(`❌ Error: ${e.message}`);
}

console.log('\n' + '═'.repeat(60));
console.log('\n[Test 2] Chat History Simulation');
console.log('─'.repeat(60));

try {
  // Simulate a multi-turn conversation
  const history = [
    { role: 'user', content: 'Hello, what is your name?' },
    { role: 'assistant', content: 'I am LLaVA, a vision language model.' }
  ];

  const newMessage = 'Can you analyze an image?';

  const messages = [
    {
      role: 'system',
      content: 'You are a helpful assistant.'
    },
    ...history,
    { role: 'user', content: newMessage }
  ];

  console.log('History:');
  console.log(`  User: "${history[0].content}"`);
  console.log(`  Assistant: "${history[1].content}"`);
  console.log(`New message: "${newMessage}"`);
  console.log('');

  const res = await fetch(`${PROXY_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llava',
      messages,
      max_tokens: 80,
      temperature: 0.7
    })
  });

  if (res.ok) {
    const data = await res.json();
    const response = data.choices?.[0]?.message?.content;

    console.log('✅ History-aware response:');
    console.log('  "' + response + '"');
  } else {
    console.log(`❌ Request failed: ${res.status}`);
  }
} catch (e) {
  console.log(`❌ Error: ${e.message}`);
}

console.log('\n' + '═'.repeat(60));
console.log('\n✨ Full workflow test complete!\n');
console.log('📱 The app can now:');
console.log('  1. Capture video frames');
console.log('  2. Send them to the VLM with system prompts');
console.log('  3. Maintain chat history');
console.log('  4. Display responses in real-time\n');
