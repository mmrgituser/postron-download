const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const { spawn, execSync } = require('child_process');
const os = require('os');
const https = require('https');
const http = require('http');

// ── Default closing frame image URLs ──────────────────────────────────────
const EMBEDDED_LOGO_URLS = {
  bruce: 'https://blobanon.blob.core.windows.net/reelforge-public/closing-bb.jpeg',
  tph:   'https://blobanon.blob.core.windows.net/reelforge-public/closing-tph.jpeg',
  mmr:   'https://blobanon.blob.core.windows.net/reelforge-public/closing-mmr.jpeg',
};


async function getEmbeddedLogoPath(brand) {
  const url = EMBEDDED_LOGO_URLS[brand];
  if (!url) return null;
  const tmpPath = path.join(os.tmpdir(), `postron_logo_${brand}.jpg`);
  // Re-download if missing (OS may clear /tmp)
  if (!fs.existsSync(tmpPath)) {
    const axios = require('axios');
    const resp = await axios.get(url, { responseType: 'arraybuffer' });
    fs.writeFileSync(tmpPath, Buffer.from(resp.data));
  }
  return tmpPath;
}


// ── Settings store (simple JSON file) ──────────────────────────────────────
const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  } catch (e) {}
    return {
    imageProvider: "flux",
    fluxEndpoint: "https://mmr-azure-openai.services.ai.azure.com/providers/blackforestlabs/v1/flux-2-pro?api-version=preview",
    azureEndpoint: "https://mmr-azure-openai.cognitiveservices.azure.com/openai/deployments/o4-mini/chat/completions?api-version=2025-01-01-preview",
    azureKey: "",
    klingAK: "",
    klingSK: "",
    elevenLabsKey: "",
    elevenLabsVoiceId: "WmHEkAz05zAfnt1BRmdb",
    outputFolder: path.join(app.getPath('documents'), 'postron'),
    stylePrefix: "cartoon illustration style, warm vibrant colors, clean linework, approachable and modern feel, safe for all audiences. If the eyes are open, show the white sclera (don't make them just black dots). The person shown wears casual professional clothing such as a collared shirt or smart casual top — no white coat, no scrubs, no stethoscope. Consistent appearance: dark short hair, neatly groomed. DO NOT INCLUDE ANY TEXT, LETTERS, WORDS, or NUMBERS.",
    metricoolToken: "",
    metricoolUserId: "",
    blogIdBruce: "",
    blogIdTPH: "",
    blogIdMMR: "",
    azureBlobConnection: "",
    freesoundKey: "",
    freesoundClientId: "",
    topicsPrompt: "You are a social media content strategist specializing in short-form vertical video (TikTok/Reels). Generate exactly 8 compelling video topics for the category provided.\n\nEach topic should be a specific, curiosity-driven angle — not generic. Make them authoritative AND relatable. Topics should be punchy enough to work as a video title. \n\nReturn ONLY a JSON array of 8 strings, no explanation, no preamble.",
    hooksPrompt: "You are a social media scriptwriter for short vertical videos. Write punchy hooks for individuals interested in health and medicine. Do not include any statistics, percentages, or numerical claims but you may include counterintuitive observations (but do not hallucinate ideas). You must verify any stats before publishing. Return ONLY a JSON array of exactly 5 hook strings, no explanation.",
    scriptsPrompt: "You are a social media scriptwriter for short vertical videos (30-60 seconds). You write in a clear, authoritative yet conversational tone like a knowledgeable person talking directly to a patient. It should be a storyline that is easy to follow but also includes real life, verifiable details. If it includes topics that a reasonable person would question (\"did that really happen?\"), then please give specific, verifiable information that you have referenced from the internet of something that actually happened (do not hallucinate sources, sources must truly exist). \n\nGenerate 3 different script angles for the given topic. Each angle should have a different narrative approach but ALL angles should work with the selected hook as the opening line.\n\nCRITICAL: The hook is spoken on-camera by the talent BEFORE the scripted segments play. Segment 1's voiceover must NOT repeat or paraphrase the hook — it should immediately continue the story, provide context, or go deeper. The viewer has already heard the hook.\n\nEach script should have exactly {SEGMENT_COUNT} segments (image + voiceover pairs). Keep each voiceover to 1-2 sentences max, under 30 words. NEVER prefix voiceover text with labels like \"Segment 1\", \"Segment 2 (Title):\", or any other heading — output the spoken words only, starting directly with the first word of dialogue.\n\nIMAGE PROMPT RULES — apply to every image_prompt field:\n- Describe the visual scene only: subject, setting, mood, lighting, colors, composition.\n- Do NOT include style instructions (e.g. \"cartoon style\", \"cinematic\") — those are added separately.\n- NEVER depict phones, tablets, computers, TV screens, or any device with a screen.\n- NEVER depict books, signs, whiteboards, labels, newspapers, or any surface with readable text.\n- If the concept involves technology or media, show the EMOTION or EFFECT instead — a person looking relieved, surprised, or engaged in a meaningful environment.\n- If the concept involves data or statistics, show a visual METAPHOR — a scale balancing, a path diverging, hands holding something symbolic.\n- Think in feelings, environments, body language, and symbolic objects.\n- Be very clear about your descriptions because the AI image gen model might misinterpret your prompt. For example instead of saying \"awakening to a sunrise\" say \"man laying in bed awakening and outside the window there is a sun rise\"\n\nReturn ONLY valid JSON — no markdown fences, no explanation, no text before or after. The response MUST be a JSON object starting with {\"angles\":[...]} exactly matching this schema:\n{JSON_SCHEMA}",
    logoBruce: "",
    logoTPH: "",
    logoMMR: "",
    closingBruce: "Please follow the channel for more on guidance on tech and mental health.",
    closingTph: "Follow for more mental health tips and education.",
    closingMmr: "Follow for more info on patient health advocacy. We want to empower you with your data.",
  };
}

function saveSettings(settings) {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

// ── Window ──────────────────────────────────────────────────────────────────
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 820,
    minWidth: 960, minHeight: 700,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile('src/index.html');
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ── IPC: Settings ───────────────────────────────────────────────────────────
ipcMain.handle('get-settings', () => loadSettings());
ipcMain.handle('save-settings', (_, settings) => { saveSettings(settings); return true; });

// ── IPC: File dialogs ────────────────────────────────────────────────────────
ipcMain.handle('pick-video', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Intro Video',
    filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'avi', 'mkv', 'm4v'] }],
    properties: ['openFile'],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('pick-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Output Folder',
    properties: ['openDirectory', 'createDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('open-folder', (_, folderPath) => {
  shell.openPath(folderPath);
});

ipcMain.handle('reveal-file', (_, filePath) => {
  shell.showItemInFolder(filePath);
});

// ── IPC: Azure OpenAI ────────────────────────────────────────────────────────
ipcMain.handle('azure-generate-topics', async (_, { endpoint, key, category, topicsPrompt }) => {
  const systemPrompt = topicsPrompt || `You are a social media content strategist specializing in short-form vertical video (TikTok/Reels).
Generate exactly 8 compelling video topics for the category provided.
Return ONLY a JSON array of strings, no explanation. Example: ["Topic 1","Topic 2"]`;

  const userPrompt = `Category: ${category}\n\nGenerate 8 short-form video topic hooks. Each should be a specific, curiosity-driven angle (not generic). Make them feel like they belong on a doctor's social media page — authoritative but relatable.`;

  return await callAzureOpenAI(endpoint, key, systemPrompt, userPrompt);
});

ipcMain.handle('azure-generate-scripts', async (_, { endpoint, key, topic, category, stylePrefix, segmentCount, hooksPrompt, scriptsPrompt, hook, extraPrompt }) => {
  const n = segmentCount || 3;

  // IMPORTANT: each segment object must contain BOTH image_prompt AND script in the same object
  const seg = `{"image_prompt":"scene description here","script":"voiceover text here"}`;
  const segList = Array.from({ length: n }, (_, i) => seg).join(',\n      ');
  const angleTemplate = `{"title":"Angle Name","segments":[\n      ${segList}\n    ]}`;
  const jsonSchema = `{"angles":[\n  ${angleTemplate},\n  ${angleTemplate},\n  ${angleTemplate}\n]}`;

  // scriptsPrompt IS the full prompt from the textarea — substitute placeholders
  const fullPrompt = (scriptsPrompt || '')
    .replace(/{SEGMENT_COUNT}/g, String(n))
    .replace(/{JSON_SCHEMA}/g, jsonSchema);

  // System prompt = the full editable prompt (with placeholders filled)
  const systemPrompt = fullPrompt;

  // User prompt = only the dynamic per-generation variables — nothing hidden
  const userPrompt =
`Category: ${category}
Topic: ${topic}
Selected hook (spoken on-camera before segments play): "${hook || topic}"
Number of segments per angle: ${n}

CRITICAL: Return ONLY the JSON object matching the schema above — starting with {"angles":[...]} containing exactly 3 angle objects. Each segment object MUST contain BOTH "image_prompt" AND "script" keys together in the same object. Do NOT separate them into alternating objects. Do NOT return a flat {hook, segments} object. Do NOT include any text outside the JSON.`;

  return await callAzureOpenAI(endpoint, key, systemPrompt, userPrompt);
});

ipcMain.handle('azure-generate-topic-hooks', async (_, { endpoint, key, topic, category, hooksPrompt }) => {
  const systemPrompt = hooksPrompt ||
    `You are a social media scriptwriter for short vertical videos. Write punchy hooks for individuals interested in health and medicine. Do not include any statistics, percentages, or numerical claims but you may include counterintuitive observations (but do not hallucinate ideas). You must verify any stats before publishing. Return ONLY a JSON array of exactly 4 hook strings (the caller will prepend a 5th), no explanation.`;
  const userPrompt = `Category: ${category}\nTopic: ${topic}\n\nGenerate 4 additional punchy video hook suggestions — different angles from the topic itself. Short lines the on-camera talent says to grab attention. The topic "${topic}" will already be used as the first hook, so make these 4 distinct variations. Return a JSON array of 4 strings.`;
  const raw = await callAzureOpenAI(endpoint, key, systemPrompt, userPrompt);
  // Prepend the topic as hook #1 — it's usually already phrased as a strong hook
  try {
    const arr = JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw));
    if (Array.isArray(arr)) {
      return JSON.stringify([topic, ...arr]);
    }
  } catch (_) {}
  return raw;
});

function callAzureOpenAI(endpoint, key, systemPrompt, userPrompt) {
  return new Promise((resolve, reject) => {
    // Normalize endpoint — strip trailing slash, append chat completions path
    let base = endpoint.replace(/\/$/, '');
    // If endpoint already has /chat/completions, use as-is; otherwise append
    let urlStr = base.includes('/chat/completions') ? base
      : `${base}/chat/completions?api-version=2025-01-01-preview`;

    const body = JSON.stringify({
      messages: [
        {
          role: 'user',
          content: systemPrompt + '\n\n' + userPrompt,
        },
      ],
      max_completion_tokens: 8000,
    });

    const url = new URL(urlStr);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': key,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          console.log('[Azure raw response] status=' + res.statusCode, data.slice(0, 400));
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          const content = parsed.choices?.[0]?.message?.content || '';
          if (!content) {
            console.log('[Azure full parsed]', JSON.stringify(parsed).slice(0, 600));
            return reject(new Error('Model returned empty response — try again or check Azure logs\nRaw response: ' + data.slice(0, 300)));
          }
          resolve(content);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── IPC: Pipeline ────────────────────────────────────────────────────────────
ipcMain.handle('run-pipeline', async (event, jobConfig) => {
  const settings = loadSettings();
  const workDir = path.join(os.tmpdir(), `postron_${Date.now()}`);
  fs.mkdirSync(workDir, { recursive: true });
  fs.mkdirSync(jobConfig.outputFolder, { recursive: true });

  const send = (type, data) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('pipeline-progress', { type, ...data });
    }
  };

  try {
    const { batchId, introVideo, stylePrefix, segments, outputFolder } = jobConfig;

    send('log', { msg: `Starting job: ${batchId}` });
    send('step', { step: 1, label: 'Extracting face reference...' });

    // Step 1: Extract face frame
    const frameDir = workDir;
    const facePath = path.join(frameDir, 'face_reference.jpg');
    await runFFmpeg([
      '-ss', '1.0', '-i', introVideo,
      '-frames:v', '1', '-q:v', '2', facePath
    ]);
    send('log', { msg: '✓ Face reference extracted' });

    // Step 2: Upload reference image
    send('step', { step: 2, label: 'Uploading face reference...' });
    const referenceUrl = await uploadImage(facePath);
    send('log', { msg: `✓ Reference uploaded: ${referenceUrl}` });

    // Step 3: Prepare intro video
    send('step', { step: 3, label: 'Preparing intro video...' });
    const introPrepared = path.join(workDir, 'intro_prepared.mp4');
    await runFFmpeg([
      '-i', introVideo,
      '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
      '-c:v', 'libx264', '-c:a', 'aac', '-b:a', '192k',
      '-preset', 'fast', '-crf', '18', introPrepared
    ]);
    send('log', { msg: '✓ Intro video prepared' });

    const segmentVideos = [];
    const segmentAudios = [];

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      send('step', { step: 4 + i, label: `Segment ${i + 1}/${segments.length}: Generating image...` });

      const imgPath = await generateImage({
        prompt: seg.image_prompt,
        stylePrefix,
        referenceUrl,
        outputPath: path.join(workDir, `image_${i}.jpg`),
        settings,
      });
      send('log', { msg: `✓ Image ${i + 1} generated` });

      // Check for user-recorded voiceover first, fall back to ElevenLabs
      send('log', { msg: `  Generating voiceover ${i + 1}...` });
      const audioPath = path.join(workDir, `audio_${i}.mp3`);
      const recPath = path.join(app.getPath('userData'), 'recordings', batchId, `seg_${i}.mp3`);
      if (fs.existsSync(recPath) && fs.statSync(recPath).size > 1000) {
        fs.copyFileSync(recPath, audioPath);
        send('log', { msg: `✓ Voiceover ${i + 1} (recorded)` });
      } else {
        await generateElevenLabsAudio({
          text: seg.script,
          outputPath: audioPath,
          settings,
        });
        send('log', { msg: `✓ Voiceover ${i + 1} generated` });
      }

      // Ken Burns pan
      send('log', { msg: `  Rendering Ken Burns clip ${i + 1}...` });
      const duration = await getAudioDuration(audioPath);
      const clipPath = path.join(workDir, `clip_${i}.mp4`);
      const directions = ['left_to_right', 'right_to_left', 'zoom_in', 'zoom_out'];
      const direction = directions[Math.floor(Math.random() * directions.length)];
      await renderKenBurns({ imgPath, duration, outputPath: clipPath, direction });
      send('log', { msg: `✓ Clip ${i + 1} rendered (${direction}, ${duration.toFixed(1)}s)` });

      segmentVideos.push(clipPath);
      segmentAudios.push(audioPath);
    }

    // Assemble final video
    send('step', { step: 10, label: 'Assembling final video...' });
    const outputPath = path.join(outputFolder, `${batchId}.mp4`);
    await assembleVideo({
      introPrepared, segmentVideos, segmentAudios,
      outputPath, workDir,
    });

    send('done', { outputPath });
    send('log', { msg: `✅ Done! Saved to: ${outputPath}` });

    // Cleanup
    fs.rmSync(workDir, { recursive: true, force: true });
    return { success: true, outputPath };

  } catch (err) {
    send('error', { msg: err.message });
    return { success: false, error: err.message };
  }
});

// ── Pipeline helpers ─────────────────────────────────────────────────────────

function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', ['-y', ...args]);
    let stderr = '';
    proc.stderr.on('data', d => stderr += d.toString());
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg failed (${code}):\n${stderr.slice(-500)}`));
    });
  });
}

function getAudioDuration(audioPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v', 'quiet', '-print_format', 'json', '-show_streams', audioPath
    ]);
    let out = '';
    proc.stdout.on('data', d => out += d.toString());
    proc.on('close', () => {
      try { resolve(parseFloat(JSON.parse(out).streams[0].duration)); }
      catch (e) { reject(e); }
    });
  });
}

function uploadImage(imagePath) {
  return new Promise((resolve, reject) => {
    const fileData = fs.readFileSync(imagePath);
    const boundary = '----FormBoundary' + Math.random().toString(36);
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="ref.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      fileData,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const options = {
      hostname: '0x0.st', path: '/', method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve(data.trim()));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function makeKlingJWT(ak, sk) {
  const crypto = require('crypto');
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: ak,
    exp: Math.floor(Date.now() / 1000) + 1800,
    nbf: Math.floor(Date.now() / 1000) - 5,
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', sk).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const opts = {
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr), ...headers },
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Non-JSON response (HTTP ${res.statusCode}): ${data.trim().slice(0, 300)}`)); }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function httpsGet(hostname, pathStr, headers, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const opts = { hostname, path: pathStr, method: 'GET', headers };
    const req = https.request(opts, res => {
      // Follow redirects
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && redirectCount < 5) {
        res.resume();
        const loc = res.headers.location;
        const u = loc.startsWith('http') ? new URL(loc) : new URL(`https://${hostname}${loc}`);
        return httpsGet(u.hostname, u.pathname + u.search, headers, redirectCount + 1).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        const trimmed = data.trim();
        // If it looks like a URL, return it as a string directly
        if (trimmed.startsWith('http')) { resolve(trimmed); return; }
        try { resolve(JSON.parse(trimmed)); }
        catch (e) { resolve(trimmed); } // return raw string on non-JSON
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ── IPC: Metricool scheduling ─────────────────────────────────────────────────

ipcMain.handle('metricool-get-scheduled-count', async (_, { token, userId, blogId, dateStr }) => {
  try {
    const qs = `userId=${userId}&blogId=${blogId}&from=${dateStr}&to=${dateStr}`;
    const result = await httpsGet(
      'app.metricool.com',
      `/api/v2/scheduler/posts?${qs}`,
      { 'X-Mc-Auth': token }
    );
    const posts = Array.isArray(result) ? result : (result?.data ?? []);
    return { count: posts.length };
  } catch (e) {
    return { count: 0, error: e.message };
  }
});

ipcMain.handle('metricool-schedule-post', async (_, {
  token, userId, blogId,
  videoPath, caption, networks, scheduledDateTime, timezone,
  azureBlobConnectionString, firstComment, publishNow, draft,
  videoThumbnailPath, coverImagePath, // accept both names
  outputFolder,
}) => {
  const thumbPath = videoThumbnailPath || coverImagePath || null;

  const publishNowDt = new Date(Date.now() + 2 * 60 * 1000);
  let effectiveDateTime, effectiveTimezone;
  if (publishNow) {
    effectiveDateTime = publishNowDt.toISOString().slice(0, 19);
    effectiveTimezone = 'UTC';
  } else {
    const tz = timezone || 'America/New_York';
    const localDate = new Date(scheduledDateTime);
    const nowUtc = Date.now();
    const tzStr = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).format(nowUtc).replace(/(\d+)\/(\d+)\/(\d+),\s(\d+):(\d+):(\d+)/, '$3-$1-$2T$4:$5:$6');
    const offsetMs = nowUtc - new Date(tzStr).getTime();
    effectiveDateTime = new Date(localDate.getTime() + offsetMs).toISOString().slice(0, 19);
    effectiveTimezone = 'UTC';
  }

  // Upload video (plain public URL, no expiry token)
  const blobName = `reelforge-${Date.now()}.mp4`;
  const publicUrl = await uploadToBlobPublic(videoPath, blobName, azureBlobConnectionString);

  /* ── THUMBNAIL AZURE UPLOAD (commented out — text overlay used instead) ──
  const verticalNetworks = ['facebook', 'instagram', 'tiktok'];
  const hasVerticalNetwork = networks.some(n => verticalNetworks.includes(n));
  let thumbnailPublicUrl = null;
  if (thumbPath && fs.existsSync(thumbPath) && hasVerticalNetwork) { ... }
  ── END THUMBNAIL AZURE ── */
  const thumbnailPublicUrl = null; // no thumbnail — text overlay on video instead

  const providers = networks.map(n => ({ network: n }));
  const postBody = {
    publicationDate: { dateTime: effectiveDateTime, timezone: effectiveTimezone },
    text: caption,
    providers,
    autoPublish: true,
    saveExternalMediaFiles: true,
    shortener: false,
    draft: draft || false,
    media: [publicUrl], // thumbnail removed — text overlay on video instead
    ...(networks.includes('facebook')  ? { facebookData:  { type: 'REEL' } } : {}),
    ...(networks.includes('instagram') ? { instagramData: { type: 'REEL', autoPublish: true } } : {}),
    ...(networks.includes('tiktok')    ? { tiktokData:    { privacyOption: 'PUBLIC_TO_EVERYONE' } } : {}),
    ...(networks.includes('linkedin')  ? { linkedinData:  {} } : {}),
    ...(networks.includes('youtube')   ? { youtubeData:   { title: caption.split(/[.\n]/)[0].slice(0, 100).trim() || 'New Video', madeForKids: false } } : {}),
    ...(firstComment ? { firstCommentText: firstComment } : {}),
  };

  const scheduleQs = `userId=${userId}&blogId=${blogId}`;
  console.log('[Metricool post body]', JSON.stringify(postBody, null, 2));
  const schedResult = await httpsPost(
    'app.metricool.com', `/api/v2/scheduler/posts?${scheduleQs}`,
    { 'X-Mc-Auth': token, 'Content-Type': 'application/json' }, postBody
  );
  if (schedResult?.error) throw new Error(`Schedule failed: ${JSON.stringify(schedResult.error)}`);
  console.log('[Metricool schedResult]', JSON.stringify(schedResult, null, 2));

  /* ── VIDEO THUMBNAIL (commented out — text overlay used instead) ──────────
  if (thumbnailPublicUrl && thumbPath) {
    // ... thumbnail upload logic removed, see git history ...
  }
  ── END THUMBNAIL ── */

  return { success: true, result: schedResult };
});

ipcMain.handle('check-path-exists', (_, p) => fs.existsSync(p));

// ── Copy processed video over the original output file ─────────────────────
ipcMain.handle('copy-to-output', async (_, { src, dest }) => {
  try {
    fs.copyFileSync(src, dest);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ── Text overlay: burn text onto first N seconds of video ─────────────────
ipcMain.handle('apply-text-overlay', async (_, { videoPath, overlayImagePath, durationSecs = 4, outputFolder }) => {
  // overlayImagePath: a PNG rendered by the renderer's canvas (1080x1920) with text already drawn
  // We use ffmpeg overlay filter to composite it over the first N seconds — no libfreetype needed
  try {
    const tmpDir = path.join(os.tmpdir(), 'postron_overlays');
    fs.mkdirSync(tmpDir, { recursive: true });
    const outPath = path.join(tmpDir, `overlay_${Date.now()}.mp4`);

    // overlay=0:0:enable='between(t,0,N)' composites the PNG (with transparency) over video
    await runFFmpeg([
      '-i', videoPath,
      '-i', overlayImagePath,
      '-filter_complex',
      `[0:v][1:v]overlay=0:0:enable='between(t,0,${durationSecs})'[v]`,
      '-map', '[v]', '-map', '0:a',
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
      '-c:a', 'copy',
      '-movflags', '+faststart',
      outPath,
    ]);
    return { success: true, outputPath: outPath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ── Background music: mix audio track under video at given volume ─────────
ipcMain.handle('apply-background-music', async (_, { videoPath, musicPath, musicVolume = 0.15, outputFolder }) => {
  try {
    const outDir = path.join(os.tmpdir(), 'postron_music'); // always tmp — final copy replaces original
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `music_${Date.now()}.mp4`);

    // Probe video duration
    const { stdout } = await new Promise((res, rej) => {
      const { execFile } = require('child_process');
      execFile('ffprobe', ['-v','quiet','-print_format','json','-show_format', videoPath],
        (err, stdout) => err ? rej(err) : res({ stdout }));
    });
    const dur = parseFloat(JSON.parse(stdout).format.duration || '60');

    // Mix: loop music to video length, fade out last 2s, mix at musicVolume under voice
    await runFFmpeg([
      '-i', videoPath,
      '-stream_loop', '-1', '-i', musicPath,
      '-filter_complex',
      `[1:a]atrim=0:${dur},afade=t=out:st=${Math.max(dur-2,0)}:d=2,volume=${musicVolume}[bg];` +
      `[0:a][bg]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[aout]`,
      '-map', '0:v', '-map', '[aout]',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
      '-movflags', '+faststart',
      outPath,
    ]);
    return { success: true, outputPath: outPath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ── Freesound: search tracks ───────────────────────────────────────────────
ipcMain.handle('freesound-search', async (_, { clientId, apiKey, query, page = 1, tags }) => {
  try {
    // Only use confirmed valid Freesound filter fields
    // type:mp3 excluded — we always use preview mp3s regardless of upload format
    // avg_rating excluded — many good tracks have no ratings yet
    let filter = 'duration:[10 TO 300] license:"Creative Commons 0"';

    // tags[] adds additional tag: filters (e.g. from category/subcategory buttons)
    if (tags && tags.length) {
      tags.forEach(t => { filter += ` tag:${t}`; });
    }

    const qs = new URLSearchParams({
      query: query || '',
      token: apiKey,
      filter,
      fields: 'id,name,duration,previews,username,license,avg_rating,num_ratings',
      page_size: 50,
      page,
      sort: 'rating_desc',
    }).toString();

    const result = await httpsGet('freesound.org', `/apiv2/search/text/?${qs}`, {
      'Authorization': `Token ${apiKey}`,
    });

    return { success: true, results: result?.results || [], count: result?.count || 0 };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ── Freesound: download preview mp3 to temp ────────────────────────────────
// ── Freesound: lookup a single sound by URL or ID ────────────────────────
ipcMain.handle('freesound-lookup', async (_, { apiKey, soundUrl }) => {
  try {
    // Extract numeric ID from URL like https://freesound.org/people/user/sounds/123456/
    const match = soundUrl.match(/\/sounds\/(\d+)/);
    if (!match) return { success: false, error: 'Could not find a sound ID in that URL. Expected format: freesound.org/people/.../sounds/12345/' };
    const soundId = match[1];
    const result = await httpsGet('freesound.org', `/apiv2/sounds/${soundId}/?token=${apiKey}&fields=id,name,duration,previews,username,license,avg_rating,num_ratings`, {
      'Authorization': `Token ${apiKey}`,
    });
    if (result?.detail) return { success: false, error: result.detail };
    // Only allow CC0
    // License field returns a URL: "http://creativecommons.org/publicdomain/zero/1.0/" for CC0
    // or "http://creativecommons.org/licenses/by/..." for Attribution etc.
    const isCC0 = !result?.license || result.license.includes('zero') || result.license.includes('Creative Commons 0');
    if (!isCC0) {
      return { success: false, error: `This track requires attribution (${result.license}) — only CC0 (no attribution) tracks are allowed.` };
    }
    return { success: true, sound: result };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('freesound-download-preview', async (_, { previewUrl }) => {
  try {
    const tmpDir = path.join(os.tmpdir(), 'postron_music_cache');
    fs.mkdirSync(tmpDir, { recursive: true });
    const fileName = 'fs_' + previewUrl.split('/').pop().split('?')[0];
    const filePath = path.join(tmpDir, fileName);
    if (fs.existsSync(filePath)) return { success: true, path: filePath }; // cached

    await new Promise((resolve, reject) => {
      const file = fs.createWriteStream(filePath);
      const url = new URL(previewUrl);
      https.get({ hostname: url.hostname, path: url.pathname + url.search }, res => {
        if ([301,302,307,308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          const loc = new URL(res.headers.location);
          https.get({ hostname: loc.hostname, path: loc.pathname + loc.search }, res2 => {
            res2.pipe(file);
            file.on('finish', resolve);
          }).on('error', reject);
        } else {
          res.pipe(file);
          file.on('finish', resolve);
        }
      }).on('error', reject);
    });
    return { success: true, path: filePath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});


ipcMain.handle('pick-any-video', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Video File',
    filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'avi', 'mkv', 'm4v'] }],
    properties: ['openFile'],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('extract-frame', async (_, { videoPath, seekSeconds = 1 }) => {
  const tmpDir = path.join(os.tmpdir(), 'postron_frames');
  fs.mkdirSync(tmpDir, { recursive: true });
  const outPath = path.join(tmpDir, `frame_${Date.now()}.jpg`);
  await runFFmpeg([
    '-ss', String(seekSeconds),
    '-i', videoPath,
    '-frames:v', '1',
    '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
    '-q:v', '2',
    outPath,
  ]);
  return { path: outPath };
});

ipcMain.handle('save-cover-image', async (_, { base64, ext = 'jpg' }) => {
  try {
    const tmpDir = path.join(os.tmpdir(), 'postron_covers');
    fs.mkdirSync(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, `cover_${Date.now()}.${ext}`);
    fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
    return { path: filePath };
  } catch (e) { return { error: e.message }; }
});

ipcMain.handle('pick-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Image',
    filters: [{ name: 'Image', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
    properties: ['openFile'],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('pick-any-file', async (_, { filters } = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select File',
    filters: filters || [{ name: 'All Files', extensions: ['*'] }],
    properties: ['openFile'],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('read-file', async (_, filePath) => {
  return fs.readFileSync(filePath, 'utf8');
});

ipcMain.handle('get-embedded-logo', async (_, brand) => {
  return await getEmbeddedLogoPath(brand);
});

ipcMain.handle('render-closing', async (_, { logoPath, voiceoverText, overlayPngPath, outputFolder, batchId, settings }) => {
  const workDir = path.join(os.tmpdir(), `postron_closing_${Date.now()}`);
  fs.mkdirSync(workDir, { recursive: true });
  try {
    const audioPath = path.join(workDir, 'closing_audio.mp3');
    // Check for user-recorded closing voiceover
    const recPath = path.join(app.getPath('userData'), 'recordings', batchId, 'seg_closing.mp3');
    if (fs.existsSync(recPath) && fs.statSync(recPath).size > 1000) {
      fs.copyFileSync(recPath, audioPath);
    } else {
      await generateElevenLabsAudio({ text: voiceoverText, outputPath: audioPath, settings, isClosing: true });
    }
    const duration = await getAudioDuration(audioPath);
    const clipPath = path.join(workDir, 'closing_clip.mp4');
    await renderKenBurns({ imgPath: logoPath, duration, outputPath: clipPath, direction: 'zoom_in' });

    // Mux video + audio
    const muxedPath = path.join(workDir, 'closing_muxed.mp4');
    await runFFmpeg(['-i', clipPath, '-i', audioPath, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-shortest', muxedPath]);

    fs.mkdirSync(outputFolder, { recursive: true });
    const outputPath = path.join(outputFolder, `${batchId}_closing.mp4`);

    // Composite overlay PNG if provided (rendered by renderer canvas — no libfreetype/drawtext needed)
    if (overlayPngPath && fs.existsSync(overlayPngPath)) {
      await runFFmpeg([
        '-i', muxedPath,
        '-i', overlayPngPath,
        '-filter_complex', '[0:v][1:v]overlay=0:0',
        '-c:a', 'copy', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
        outputPath
      ]);
    } else {
      fs.copyFileSync(muxedPath, outputPath);
    }

    return { success: true, outputPath };
  } catch (e) {
    return { success: false, error: e.message };
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});

// ── Scripts library ───────────────────────────────────────────────────────────
const SCRIPTS_PATH = path.join(app.getPath('userData'), 'scripts.json');
function loadScriptsFromDisk() {
  try { if (fs.existsSync(SCRIPTS_PATH)) return JSON.parse(fs.readFileSync(SCRIPTS_PATH, 'utf8')); } catch (e) {}
  return [];
}
function saveScriptsToDisk(scripts) {
  fs.writeFileSync(SCRIPTS_PATH, JSON.stringify(scripts, null, 2));
}
ipcMain.handle('load-scripts', () => loadScriptsFromDisk());
ipcMain.handle('save-script', (_, entry) => {
  const scripts = loadScriptsFromDisk();
  const idx = scripts.findIndex(s => s.id === entry.id);
  if (idx >= 0) scripts[idx] = entry; else scripts.unshift(entry);
  saveScriptsToDisk(scripts); return true;
});
ipcMain.handle('delete-script', (_, id) => {
  saveScriptsToDisk(loadScriptsFromDisk().filter(s => s.id !== id)); return true;
});

ipcMain.handle('generate-caption', async (_, { endpoint, key, topic, hook, scripts, networks }) => {
  const networkList = (networks || []).join(', ') || 'Instagram, TikTok, YouTube';
  const systemPrompt = `You are a social media copywriter for a psychiatrist. Write engaging captions for short-form video. Return ONLY valid JSON, no markdown: {"caption":"..."}`;
  const userPrompt = `Topic: ${topic}\nHook: ${hook}\nScript segments:\n${scripts.map((s, i) => `${i + 1}. ${s}`).join('\n')}\nNetworks: ${networkList}\n\nWrite a caption (150-300 words) with 5-8 hashtags at the end. Return as JSON {"caption":"..."}.`;
  return await callAzureOpenAI(endpoint, key, systemPrompt, userPrompt);
});

ipcMain.handle('metricool-get-brands', async (_, { token, userId }) => {
  try {
    const result = await httpsGet('app.metricool.com', `/api/admin/simpleProfiles?userId=${userId}`, { 'X-Mc-Auth': token });
    return { success: true, brands: Array.isArray(result) ? result : (result?.data ?? []) };
  } catch (e) { return { success: false, error: e.message }; }
});

// ── Voiceover recording ─────────────────────────────────────────────────────
ipcMain.handle('save-recording', async (event, { batchId, segmentIndex, buffer }) => {
  const recDir = path.join(app.getPath('userData'), 'recordings', batchId);
  fs.mkdirSync(recDir, { recursive: true });
  const wavPath = path.join(recDir, `seg_${segmentIndex}.wav`);
  const mp3Path = path.join(recDir, `seg_${segmentIndex}.mp3`);
  const buf = Buffer.from(buffer);
  fs.writeFileSync(wavPath, buf);
  // Convert to mp3 with loudness normalization (-16 LUFS broadcast standard)
  await runFFmpeg(['-i', wavPath, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', '192k', mp3Path]);
  fs.unlinkSync(wavPath);
  return { path: mp3Path };
});

ipcMain.handle('read-file-as-data-url', async (event, filePath) => {
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.mp3' ? 'audio/mpeg' : ext === '.wav' ? 'audio/wav' : 'audio/webm';
  return `data:${mime};base64,${buf.toString('base64')}`;
});

// Pre-generate a single segment's ElevenLabs audio so user can preview before recording
ipcMain.handle('generate-segment-audio', async (event, { text, segmentIndex, batchId, isHook, isClosing }) => {
  const settings = loadSettings();
  const ttsDir = path.join(app.getPath('userData'), 'recordings', batchId, 'tts');
  fs.mkdirSync(ttsDir, { recursive: true });
  const audioPath = path.join(ttsDir, `seg_${segmentIndex}.mp3`);
  await generateElevenLabsAudio({ text, outputPath: audioPath, settings, isHook: !!isHook, isClosing: !!isClosing });
  return { path: audioPath };
});

ipcMain.handle('run-image-gen', async (event, { batchId, introVideo, stylePrefix, segments, outputFolder }) => {
  const settings = loadSettings();
  const workDir = path.join(os.tmpdir(), `postron_img_${batchId}`);
  fs.mkdirSync(workDir, { recursive: true });
  const send = (type, data) => { if (!mainWindow.isDestroyed()) mainWindow.webContents.send('pipeline-progress', { type, ...data }); };
  try {
    let referenceUrl = null;
    if (introVideo) {
      send('log', { msg: 'Extracting face reference…' });
      const facePath = path.join(workDir, 'face_reference.jpg');
      await runFFmpeg(['-ss', '1.0', '-i', introVideo, '-frames:v', '1', '-q:v', '2', facePath]);
      referenceUrl = await uploadImage(facePath);
      send('log', { msg: '✓ Reference uploaded' });
    }
    const imageResults = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      send('step', { step: i + 1, label: `Generating image ${i + 1}/${segments.length}…` });
      const imgPath = path.join(workDir, `image_${i}.jpg`);
      try {
        await generateImage({ prompt: seg.image_prompt, stylePrefix: stylePrefix || settings.stylePrefix || '', referenceUrl, outputPath: imgPath, settings });
        send('image-ready', { idx: i, imagePath: imgPath });
        imageResults.push({ idx: i, imagePath: imgPath, prompt: seg.image_prompt });
      } catch (e) {
        send('image-error', { idx: i, error: e.message });
        imageResults.push({ idx: i, imagePath: null, prompt: seg.image_prompt, error: e.message });
      }
    }
    send('flush', {});
    return { success: true, imageResults, workDir };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('regenerate-single-image', async (_, { batchId, segIdx, prompt, stylePrefix, useFaceRef }) => {
  const settings = loadSettings();
  const workDir = path.join(os.tmpdir(), `postron_img_${batchId}`);
  fs.mkdirSync(workDir, { recursive: true });
  try {
    let referenceUrl = null;
    if (useFaceRef) {
      const facePath = path.join(workDir, 'face_reference.jpg');
      if (fs.existsSync(facePath)) referenceUrl = await uploadImage(facePath);
    }
    const imgPath = path.join(workDir, `image_${segIdx}.jpg`);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    await generateImage({ prompt, stylePrefix: stylePrefix || settings.stylePrefix || '', referenceUrl, outputPath: imgPath, settings });
    return { success: true, imagePath: imgPath };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('run-assembly', async (event, { batchId, introVideo, segments, imageResults, outputFolder, closingVideoPath, hook }) => {
  const settings = loadSettings();
  const workDir = path.join(os.tmpdir(), `postron_asm_${batchId}_${Date.now()}`);
  fs.mkdirSync(workDir, { recursive: true });
  fs.mkdirSync(outputFolder, { recursive: true });
  const send = (type, data) => { if (!mainWindow.isDestroyed()) mainWindow.webContents.send('pipeline-progress', { type, ...data }); };
  try {
    const segmentVideos = [], segmentAudios = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const imgResult = imageResults.find(r => r.idx === i);
      if (!imgResult?.imagePath) throw new Error(`No image for segment ${i + 1}`);
      send('step', { step: i + 1, label: `Segment ${i + 1}/${segments.length}: voiceover…` });
      const audioPath = path.join(workDir, `audio_${i}.mp3`);
      // Check for user-recorded audio first
      const recPath = path.join(app.getPath('userData'), 'recordings', batchId, `seg_${i}.mp3`);
      const hookRecPath = path.join(app.getPath('userData'), 'recordings', batchId, 'seg_hook.mp3');
      const isFirstWithoutIntro = !introVideo && i === 0 && hook;

      if (fs.existsSync(recPath) && fs.statSync(recPath).size > 1000) {
        // User recorded this segment
        if (isFirstWithoutIntro && fs.existsSync(hookRecPath) && fs.statSync(hookRecPath).size > 1000) {
          // Concat hook recording + segment recording
          const hookAudio = path.join(workDir, 'audio_hook.mp3');
          fs.copyFileSync(hookRecPath, hookAudio);
          const segAudio = path.join(workDir, `audio_${i}_seg.mp3`);
          fs.copyFileSync(recPath, segAudio);
          const concatList = path.join(workDir, `concat_${i}.txt`);
          fs.writeFileSync(concatList, `file '${hookAudio}'\nfile '${segAudio}'\n`);
          await runFFmpeg(['-f', 'concat', '-safe', '0', '-i', concatList, '-c', 'copy', audioPath]);
          send('log', { msg: `✓ Voiceover ${i + 1} (hook + segment recorded)` });
        } else {
          fs.copyFileSync(recPath, audioPath);
          send('log', { msg: `✓ Voiceover ${i + 1} (recorded)` });
        }
      } else if (isFirstWithoutIntro && fs.existsSync(hookRecPath) && fs.statSync(hookRecPath).size > 1000) {
        // Hook recorded but segment not — concat hook recording + segment TTS
        const hookAudio = path.join(workDir, 'audio_hook.mp3');
        fs.copyFileSync(hookRecPath, hookAudio);
        const segTtsPath = path.join(workDir, `audio_${i}_tts.mp3`);
        await generateElevenLabsAudio({ text: seg.script, outputPath: segTtsPath, settings });
        const concatList = path.join(workDir, `concat_${i}.txt`);
        fs.writeFileSync(concatList, `file '${hookAudio}'\nfile '${segTtsPath}'\n`);
        await runFFmpeg(['-f', 'concat', '-safe', '0', '-i', concatList, '-c', 'copy', audioPath]);
        send('log', { msg: `✓ Voiceover ${i + 1} (hook recorded + segment AI)` });
      } else {
        // No recordings — generate via ElevenLabs
        const voiceText = isFirstWithoutIntro ? `${hook}. ${seg.script}` : seg.script;
        await generateElevenLabsAudio({ text: voiceText, outputPath: audioPath, settings, isHook: isFirstWithoutIntro });
        send('log', { msg: `✓ Voiceover ${i + 1} generated` });
      }
      const duration = await getAudioDuration(audioPath);
      const clipPath = path.join(workDir, `clip_${i}.mp4`);
      const dirs = ['left_to_right', 'right_to_left', 'zoom_in', 'zoom_out'];
      await renderKenBurns({ imgPath: imgResult.imagePath, duration, outputPath: clipPath, direction: dirs[i % dirs.length] });
      send('log', { msg: `✓ Clip ${i + 1} rendered` });
      segmentVideos.push(clipPath);
      segmentAudios.push(audioPath);
    }
    let introPrepared = null;
    if (introVideo) {
      send('step', { step: segments.length + 1, label: 'Preparing intro video…' });
      introPrepared = path.join(workDir, 'intro_prepared.mp4');
      await runFFmpeg(['-i', introVideo, '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920', '-c:v', 'libx264', '-c:a', 'aac', '-b:a', '192k', '-preset', 'fast', '-crf', '18', introPrepared]);
      send('log', { msg: '✓ Intro prepared' });
    }
    send('step', { step: segments.length + 2, label: 'Assembling final video…' });
    const outputPath = path.join(outputFolder, `${batchId}.mp4`);
    await assembleVideo({ introPrepared, segmentVideos, segmentAudios, closingVideoPath: closingVideoPath || null, outputPath, workDir });
    send('done', { outputPath });
    send('log', { msg: `✅ Done! Saved to: ${outputPath}` });
    fs.rmSync(workDir, { recursive: true, force: true });
    return { success: true, outputPath };
  } catch (e) {
    send('error', { msg: e.message });
    return { success: false, error: e.message };
  }
});

// ── Azure Blob Storage helpers ────────────────────────────────────────────────

function parseConnectionString(connStr) {
  const parts = {};
  connStr.split(';').forEach(seg => {
    const eq = seg.indexOf('=');
    if (eq > 0) parts[seg.slice(0, eq)] = seg.slice(eq + 1);
  });
  return parts;
}

// Upload to a PUBLIC container using SAS auth for the upload,
// but returns a plain public URL (no token) since anonymous read is enabled.
async function uploadToBlobPublic(filePath, blobName, connectionString, contentType = 'video/mp4') {
  const crypto = require('crypto');
  const { AccountName: account, AccountKey: keyB64, DefaultEndpointsProtocol: proto = 'https' } = parseConnectionString(connectionString);
  if (!account || !keyB64) throw new Error('Invalid Azure Blob connection string');
  const container = 'reelforge-public';
  const fileBuffer = fs.readFileSync(filePath);
  const fileSize   = fileBuffer.length;
  const host       = `${account}.blob.core.windows.net`;
  const key        = Buffer.from(keyB64, 'base64');

  function sign(str) {
    return crypto.createHmac('sha256', key).update(str, 'utf8').digest('base64');
  }

  function makeHeaders(method, contentType, contentLength, extraXmsHeaders, resourcePath) {
    const date = new Date().toUTCString();
    // Build sorted x-ms-* canonical headers string
    const xmsMap = { 'x-ms-date': date, 'x-ms-version': '2020-04-08' };
    Object.assign(xmsMap, extraXmsHeaders);
    const canonHeaders = Object.keys(xmsMap).sort()
      .map(k => `${k}:${xmsMap[k]}`).join('\n');
    const stringToSign = [
      method,
      '',                      // Content-Encoding
      '',                      // Content-Language
      (contentLength != null && contentLength > 0) ? String(contentLength) : '',
      '',                      // Content-MD5
      contentType || '',
      '',                      // Date (using x-ms-date)
      '', '', '', '', '',      // conditionals + Range
      canonHeaders,
      resourcePath,
    ].join('\n');
    const sig = sign(stringToSign);
    const headers = { ...xmsMap, Authorization: `SharedKey ${account}:${sig}` };
    if (contentType)   headers['Content-Type']   = contentType;
    if (contentLength != null) headers['Content-Length'] = String(contentLength);
    return headers;
  }

  // ── Step 1: Create container ───────────────────────────────────────────────
  await new Promise((resolve, reject) => {
    const headers = makeHeaders('PUT', '', 0, {}, `/${account}/${container}\nrestype:container`);
    const req = https.request({
      hostname: host, method: 'PUT',
      path: `/${container}?restype=container`,
      headers,
    }, res => {
      let body = ''; res.on('data', d => body += d);
      res.on('end', () => {
        console.log('[Container create] status=' + res.statusCode);
        if (res.statusCode === 201 || res.statusCode === 409) resolve();
        else reject(new Error('Container create failed: ' + res.statusCode + ' — ' + body.slice(0, 300)));
      });
    });
    req.on('error', reject); req.end();
  });

  // ── Step 2: Set public blob ACL ────────────────────────────────────────────
  await new Promise((resolve) => {
    const headers = makeHeaders('PUT', '', 0,
      { 'x-ms-blob-public-access': 'blob' },
      `/${account}/${container}\ncomp:acl\nrestype:container`
    );
    const req = https.request({
      hostname: host, method: 'PUT',
      path: `/${container}?restype=container&comp=acl`,
      headers,
    }, res => { res.resume(); console.log('[Container ACL] status=' + res.statusCode); resolve(); });
    req.on('error', resolve); req.end();
  });

  // ── Step 3: Upload blob ────────────────────────────────────────────────────
  await new Promise((resolve, reject) => {
    const headers = makeHeaders('PUT', contentType, fileSize,
      { 'x-ms-blob-type': 'BlockBlob' },
      `/${account}/${container}/${blobName}`
    );
    const req = https.request({
      hostname: host, method: 'PUT',
      path: `/${container}/${blobName}`,
      headers,
    }, res => {
      res.resume();
      if (res.statusCode >= 400) reject(new Error(`Blob upload failed: ${res.statusCode}`));
      else resolve();
    });
    req.on('error', reject);
    req.write(fileBuffer);
    req.end();
  });

  return `${proto}://${host}/${container}/${blobName}`;
}
async function deleteBlobSilently(blobName, connectionString) {
  try {
    const crypto = require('crypto');
    const { AccountName: account, AccountKey: keyB64 } = parseConnectionString(connectionString);
    const container = 'reelforge-public';
    const host = `${account}.blob.core.windows.net`;
    const date = new Date().toUTCString();
    const canonHeaders = `x-ms-date:${date}\nx-ms-version:2020-04-08`;
    const canonResource = `/${account}/${container}/${blobName}`;
    const stringToSign = [
      'DELETE',
      '', '', '', '', '', '', '', '', '', '', '',
      canonHeaders,
      canonResource,
    ].join('\n');
    const sig = crypto.createHmac('sha256', Buffer.from(keyB64, 'base64')).update(stringToSign).digest('base64');
    await new Promise((resolve) => {
      const req = https.request({
        hostname: host, method: 'DELETE',
        path: `/${container}/${blobName}`,
        headers: {
          'x-ms-date': date,
          'x-ms-version': '2020-04-08',
          Authorization: `SharedKey ${account}:${sig}`,
        },
      }, res => { res.resume(); resolve(); });
      req.on('error', resolve);
      req.end();
    });
  } catch (_) { /* silent */ }
}

// ── Image generation router ──────────────────────────────────────────────────
async function generateImage({ prompt, stylePrefix, referenceUrl, outputPath, settings }) {
  const provider = settings.imageProvider || 'flux';
  if (provider === 'kling') {
    return generateKlingImage({ prompt, stylePrefix, referenceUrl, outputPath, settings });
  }
  return generateFluxImage({ prompt, stylePrefix, outputPath, settings });
}

async function generateFluxImage({ prompt, stylePrefix, outputPath, settings }) {
  if (fs.existsSync(outputPath)) return outputPath;

  const fullPrompt = [stylePrefix, prompt].filter(s => s && s.trim()).join(', ');
  const deploymentName = (settings.fluxDeploymentName || 'FLUX.2-pro').trim();
  const azureKey = settings.azureKey;

  // Azure Foundry gives two endpoint styles — we support both:
  //
  // Style A (OpenAI-compat, what Foundry shows in code samples):
  //   Host: mmr-azure-openai.openai.azure.com
  //   POST /openai/v1/images/generations
  //   Body: { model: "FLUX.2-pro", prompt, n, size }
  //   Response: { data: [{ b64_json: "..." }] }
  //
  // Style B (BFL native, the other URL Foundry shows):
  //   Host: mmr-azure-openai.services.ai.azure.com
  //   POST /providers/blackforestlabs/v1/flux-2-pro?api-version=preview
  //   Body: { prompt, n, size }
  //   Response: { data: [{ url: "..." }] }
  //
  // We derive the right host+path from whatever base URL the user put in Settings.

  const rawBase = (settings.fluxEndpoint || '').replace(/\/$/, '');
  if (!rawBase) throw new Error('FLUX endpoint not configured in Settings');

  // Normalise: strip any path the user may have pasted (e.g. full endpoint URL) — we only want the origin
  const parsedBase = new URL(rawBase.startsWith('http') ? rawBase : `https://${rawBase}`);
  const hostname = parsedBase.hostname;  // e.g. mmr-azure-openai.services.ai.azure.com

  // Decide style from hostname
  const isOpenAICompat = hostname.includes('.openai.azure.com');

  // BFL native body uses width/height + model + output_format, not size
  const bflBody = JSON.stringify({
    model: deploymentName,
    prompt: fullPrompt,
    width: 1024,
    height: 1792,
    output_format: 'jpeg',
    safety_tolerance: 2,
  });
  const openAIBody = JSON.stringify({ model: deploymentName, prompt: fullPrompt, n: 1, size: '1024x1792' });

  // Try every known Azure path for this deployment — stop at first success
  const bflSlug = deploymentName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const candidates = isOpenAICompat ? [
    [hostname, '/openai/v1/images/generations', openAIBody],
    [hostname, `/openai/deployments/${deploymentName}/images/generations?api-version=2024-10-21`, openAIBody],
    [hostname, `/openai/deployments/${deploymentName}/images/generations?api-version=2025-01-01-preview`, openAIBody],
  ] : [
    // BFL native endpoint — strip any path the user may have pasted, use only origin
    [hostname, `/providers/blackforestlabs/v1/${bflSlug}?api-version=preview`, bflBody],
  ];

  let lastErr = null;
  for (const [host, apiPath, reqBody] of candidates) {
    console.log(`[FLUX trying] host=${host} path=${apiPath}`);
    try {
      const result = await new Promise((resolve, reject) => {
        // BFL native endpoint uses 'api-key' header (same as Azure OpenAI)
        const opts = {
          hostname: host, path: apiPath, method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': azureKey,
            'Authorization': `Bearer ${azureKey}`,  // some BFL paths prefer Bearer
            'Content-Length': Buffer.byteLength(reqBody),
          },
        };
        const req = https.request(opts, res => {
          let data = '';
          res.on('data', c => data += c);
          res.on('end', () => {
            console.log(`[FLUX response] status=${res.statusCode}`, data.slice(0, 200));
            try {
              // Check status BEFORE parsing — 404 body may not be JSON
              if (res.statusCode === 404) return reject(Object.assign(new Error(`404: ${data.slice(0,100)}`), { skip: true }));
              if (res.statusCode === 405) return reject(Object.assign(new Error(`405: ${data.slice(0,100)}`), { skip: true }));
              const parsed = JSON.parse(data);
              if (parsed.error) return reject(new Error(`FLUX error: ${parsed.error.message || JSON.stringify(parsed.error)}`));
              if (res.statusCode >= 400) return reject(Object.assign(new Error(`HTTP ${res.statusCode}: ${data.slice(0,150)}`), { skip: true }));
              resolve(parsed);
            } catch (e) { reject(e); }
          });
        });
        req.on('error', reject);
        // 90-second timeout — FLUX can be slow but shouldn't hang forever
        req.setTimeout(90000, () => {
          req.destroy();
          reject(new Error('FLUX request timed out after 90 seconds'));
        });
        req.write(reqBody);
        req.end();
      });

      const b64 = result?.data?.[0]?.b64_json;
      const imgUrl = result?.data?.[0]?.url;
      if (b64) { fs.writeFileSync(outputPath, Buffer.from(b64, 'base64')); return outputPath; }
      if (imgUrl) { await downloadFile(imgUrl, outputPath); return outputPath; }
      throw new Error(`FLUX: no image data in response: ${JSON.stringify(result).slice(0, 200)}`);
    } catch (e) {
      if (e.skip) { lastErr = e; continue; }
      throw e;
    }
  }
  throw new Error(
    `FLUX: all paths returned 404/error for deployment "${deploymentName}".\n` +
    `In Settings, make sure:\n` +
    `• FLUX Base Endpoint = https://mmr-azure-openai.openai.azure.com\n` +
    `• FLUX Deployment Name = FLUX.2-pro (exact name from Azure Foundry)\n` +
    `Last error: ${lastErr?.message}`
  );
}

async function generateKlingImage({ prompt, stylePrefix, referenceUrl, outputPath, settings }) {
  if (fs.existsSync(outputPath)) return outputPath;
  const token = makeKlingJWT(settings.klingAK, settings.klingSK);
  const headers = { Authorization: `Bearer ${token}` };

  const resp = await httpsPost('api.klingai.com', '/v1/images/generations', headers, {
    model_name: 'kling-v1-5',
    prompt: `${stylePrefix}, ${prompt}`.trim(),
    negative_prompt: 'photorealistic, 3D render, blurry, low quality, watermark, text',
    n: 1,
    aspect_ratio: '9:16',
    image_reference: referenceUrl,
    image_fidelity: 0.85,
    human_fidelity: 0.90,
    stylized_prompt_chosen: 'surreal_photography',
  });

  if (resp.code !== 0) throw new Error(`Kling image error: ${JSON.stringify(resp)}`);
  const taskId = resp.data.task_id;

  // Poll
  for (let i = 0; i < 60; i++) {
    await sleep(5000);
    const poll = await httpsGet('api.klingai.com', `/v1/images/generations/${taskId}`, headers);
    if (poll.data?.task_status === 'succeed') {
      const imgUrl = poll.data.task_result.images[0].url;
      await downloadFile(imgUrl, outputPath);
      return outputPath;
    }
    if (poll.data?.task_status === 'failed') throw new Error('Kling image generation failed');
  }
  throw new Error('Kling image generation timed out');
}

// Pronunciation overrides for ElevenLabs — spelled phonetically to guarantee correct stress
const PRONUNCIATION_MAP = [
  // medical terms that TTS systems mispronounce
  { find: /dysautonomia/gi,    replace: 'diss-aw-tuh-NO-mee-uh' },
  { find: /fibromyalgia/gi,    replace: 'fy-bro-my-AL-juh' },
  { find: /hypochondria/gi,    replace: 'hy-po-KON-dree-uh' },
  { find: /encephalopathy/gi,  replace: 'en-SEF-uh-LOP-uh-thee' },
  { find: /myocarditis/gi,     replace: 'my-oh-kar-DY-tis' },
  { find: /tachycardia/gi,     replace: 'tak-ee-KAR-dee-uh' },
];

function applyPronunciationFixes(text) {
  let out = text;
  for (const { find, replace } of PRONUNCIATION_MAP) {
    out = out.replace(find, replace);
  }
  return out;
}

async function generateElevenLabsAudio({ text, outputPath, settings, isHook = false, isClosing = false }) {
  if (fs.existsSync(outputPath)) return outputPath;

  // Apply pronunciation fixes to all audio
  let cleanText = applyPronunciationFixes(text);

  if (isHook) {
    // Strip punctuation that causes ElevenLabs to insert unnatural pauses in hook delivery
    // Em-dashes, colons, semicolons → short pause via comma; quotes stripped
    cleanText = cleanText
      .replace(/\s*[–—]\s*/g, ', ')   // em/en dash → comma pause
      .replace(/:\s*/g, ', ')           // colon → comma
      .replace(/;/g, ',')              // semicolon → comma
      .replace(/['"''""\[\]]/g, '')    // strip all quote chars
      .replace(/\s{2,}/g, ' ')         // collapse double spaces
      .trim();
  }

  // Hook: expressive energetic delivery
  // Closing: warm, inviting, emotional CTA delivery
  // Segments: stable, clear, authoritative narration
  const voiceSettings = isHook
    ? { stability: 0.25, similarity_boost: 0.80, style: 0.65, use_speaker_boost: true }
    : isClosing
    ? { stability: 0.30, similarity_boost: 0.78, style: 0.55, use_speaker_boost: true }
    : { stability: 0.5,  similarity_boost: 0.85, style: 0.2,  use_speaker_boost: true };

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      text: cleanText,
      model_id: 'eleven_multilingual_v2',
      voice_settings: voiceSettings,
    });
    const opts = {
      hostname: 'api.elevenlabs.io',
      path: `/v1/text-to-speech/${settings.elevenLabsVoiceId}`,
      method: 'POST',
      headers: {
        'xi-api-key': settings.elevenLabsKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(opts, res => {
      if (res.statusCode !== 200) {
        let err = '';
        res.on('data', d => err += d);
        res.on('end', () => reject(new Error(`ElevenLabs error ${res.statusCode}: ${err}`)));
        return;
      }
      const file = fs.createWriteStream(outputPath);
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(outputPath); });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function renderKenBurns({ imgPath, duration, outputPath, direction }) {
  const w = 1080, h = 1920, fps = 30;
  const frames = Math.ceil(duration * fps);
  // setsar=1:1 is critical after every scale — prevents non-square SAR display bug.
  // trunc(.../2)*2 ensures even dimensions required by libx264.
  // All source images are 9:16 portrait (1024×1792 or 1080×1920) — horizontal pans
  // cut the subject in half. Use vertical pans or zoom instead.

  // VERTICAL PAN: scale image to 1.15× height (preserving AR → slightly wider too),
  // center horizontally, then drift the crop window up or down by ~15% of frame height.
  const scaleH = Math.floor((h * 1.15) / 2) * 2;  // even number, ~2208px tall
  const scaleW = Math.floor((scaleH * w / h) / 2) * 2; // maintain AR
  const panTravel = scaleH - h; // ~288px vertical travel
  const panSetup = `scale=${scaleW}:${scaleH},setsar=1:1`;

  // ZOOM: gentle 1.0→1.08 push in/out — subject stays centered
  const zoomStart = 1.0, zoomEnd = 1.08;
  const zoomInExpr  = `scale=trunc(${w}*(${zoomStart}+(${zoomEnd}-${zoomStart})*n/${frames})/2)*2:trunc(${h}*(${zoomStart}+(${zoomEnd}-${zoomStart})*n/${frames})/2)*2:eval=frame,crop=${w}:${h}:(iw-${w})/2:(ih-${h})/2,setsar=1:1`;
  const zoomOutExpr = `scale=trunc(${w}*(${zoomEnd}-(${zoomEnd}-${zoomStart})*n/${frames})/2)*2:trunc(${h}*(${zoomEnd}-(${zoomEnd}-${zoomStart})*n/${frames})/2)*2:eval=frame,crop=${w}:${h}:(iw-${w})/2:(ih-${h})/2,setsar=1:1`;

  let vf;
  if (direction === 'left_to_right') {
    // Repurposed as drift-up: start at bottom, pan upward
    vf = `${panSetup},crop=${w}:${h}:(iw-${w})/2:${panTravel}-n/${frames}*${panTravel}`;
  } else if (direction === 'right_to_left') {
    // Repurposed as drift-down: start at top, pan downward
    vf = `${panSetup},crop=${w}:${h}:(iw-${w})/2:n/${frames}*${panTravel}`;
  } else if (direction === 'zoom_in') {
    vf = zoomInExpr;
  } else {
    // zoom_out
    vf = zoomOutExpr;
  }
  await runFFmpeg([
    '-loop', '1', '-i', imgPath,
    '-vf', vf, '-t', String(duration),
    '-pix_fmt', 'yuv420p', '-c:v', 'libx264',
    '-preset', 'fast', '-crf', '18', outputPath
  ]);
}

async function assembleVideo({ introPrepared, segmentVideos, segmentAudios, closingVideoPath, outputPath, workDir }) {
  // Strategy: mux each video-only segment clip with its audio mp3, producing clips that each
  // have both streams. Then filter_complex concat all clips (+ optional intro/closing) in one pass.
  // This avoids all manual delay timing arithmetic and handles closing clip audio naturally.

  const allClips = []; // array of mp4 paths each with v+a

  // 1. Intro (already has audio track from original source)
  if (introPrepared) {
    // Re-encode to ensure matching stream params
    const introCopy = path.join(workDir, 'intro_final.mp4');
    await runFFmpeg([
      '-i', introPrepared,
      '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1:1',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', '-preset', 'fast', '-crf', '18',
      '-c:a', 'aac', '-b:a', '128k',
      introCopy,
    ]);
    allClips.push(introCopy);
  }

  // 2. Segments: mux video clip + audio mp3 into a single mp4
  for (let i = 0; i < segmentVideos.length; i++) {
    const muxed = path.join(workDir, `seg_muxed_${i}.mp4`);
    await runFFmpeg([
      '-i', segmentVideos[i], '-i', segmentAudios[i],
      '-map', '0:v', '-map', '1:a',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-shortest',
      muxed,
    ]);
    allClips.push(muxed);
  }

  // 3. Closing clip: re-encode to match stream params (it already has audio from render-closing)
  if (closingVideoPath && fs.existsSync(closingVideoPath)) {
    const closingFinal = path.join(workDir, 'closing_final.mp4');
    await runFFmpeg([
      '-i', closingVideoPath,
      '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1:1',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', '-preset', 'fast', '-crf', '18',
      '-c:a', 'aac', '-b:a', '128k',
      closingFinal,
    ]);
    allClips.push(closingFinal);
  }

  // 4. filter_complex concat all clips with both v and a streams
  const n = allClips.length;
  const inputs = allClips.flatMap(c => ['-i', c]);
  const concatInputs = allClips.map((_, i) => `[${i}:v][${i}:a]`).join('');
  const filterComplex = `${concatInputs}concat=n=${n}:v=1:a=1[v][a]`;

  await runFFmpeg([
    ...inputs,
    '-filter_complex', filterComplex,
    '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'fast', '-crf', '18',
    '-c:a', 'aac', '-b:a', '128k',
    outputPath,
  ]);
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const getter = url.startsWith('https') ? https : http;
    getter.get(url, res => {
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', err => { fs.unlink(destPath, () => {}); reject(err); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
