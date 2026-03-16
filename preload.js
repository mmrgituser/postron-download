const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('reelforge', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (s) => ipcRenderer.invoke('save-settings', s),
  pickVideo: () => ipcRenderer.invoke('pick-video'),
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  openFolder: (p) => ipcRenderer.invoke('open-folder', p),
  revealFile: (p) => ipcRenderer.invoke('reveal-file', p),
  generateTopics: (opts) => ipcRenderer.invoke('azure-generate-topics', opts),
  generateTopicHooks: (opts) => ipcRenderer.invoke('azure-generate-topic-hooks', opts),
  generateScripts: (opts) => ipcRenderer.invoke('azure-generate-scripts', opts),
  runPipeline: (job) => ipcRenderer.invoke('run-pipeline', job),
  loadScripts: () => ipcRenderer.invoke('load-scripts'),
  saveScript: (entry) => ipcRenderer.invoke('save-script', entry),
  deleteScript: (id) => ipcRenderer.invoke('delete-script', id),
  onPipelineProgress: (cb) => {
    ipcRenderer.on('pipeline-progress', (_, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('pipeline-progress');
  },
  // ── Metricool scheduling ─────────────────────────────────────────────────
  generateCaption: (opts) => ipcRenderer.invoke('generate-caption', opts),
  metricoolGetBrands: (opts) => ipcRenderer.invoke('metricool-get-brands', opts),
  metricoolGetScheduledCount: (opts) => ipcRenderer.invoke('metricool-get-scheduled-count', opts),
  metricoolSchedulePost: (opts) => ipcRenderer.invoke('metricool-schedule-post', opts),
  checkPathExists: (p) => ipcRenderer.invoke('check-path-exists', p),
  saveCoverImage: (opts) => ipcRenderer.invoke('save-cover-image', opts),
  pickImage: () => ipcRenderer.invoke('pick-image'),
  pickAnyFile: (opts) => ipcRenderer.invoke('pick-any-file', opts),
  readFile: (p) => ipcRenderer.invoke('read-file', p),
  getEmbeddedLogo: (brand) => ipcRenderer.invoke('get-embedded-logo', brand),
  renderClosing: (opts) => ipcRenderer.invoke('render-closing', opts),
  // ── Voiceover recording ──────────────────────────────────────────────────
  saveRecording: (opts) => ipcRenderer.invoke('save-recording', opts),
  generateSegmentAudio: (opts) => ipcRenderer.invoke('generate-segment-audio', opts),
  readFileAsDataUrl: (p) => ipcRenderer.invoke('read-file-as-data-url', p),
  // ── Split pipeline ───────────────────────────────────────────────────────
  runImageGen: (job) => ipcRenderer.invoke('run-image-gen', job),
  regenerateSingleImage: (opts) => ipcRenderer.invoke('regenerate-single-image', opts),
  runAssembly: (job) => ipcRenderer.invoke('run-assembly', job),
  pickAnyVideo: () => ipcRenderer.invoke('pick-any-video'),
  extractFrame: (opts) => ipcRenderer.invoke('extract-frame', opts),
  // ── Text overlay & music ─────────────────────────────────────────────────
  applyTextOverlay: (opts) => ipcRenderer.invoke('apply-text-overlay', opts),
  applyBackgroundMusic: (opts) => ipcRenderer.invoke('apply-background-music', opts),
  freesoundSearch: (opts) => ipcRenderer.invoke('freesound-search', opts),
  freesoundLookup: (opts) => ipcRenderer.invoke('freesound-lookup', opts),
  freesoundDownloadPreview: (opts) => ipcRenderer.invoke('freesound-download-preview', opts),
  copyToOutput: (opts) => ipcRenderer.invoke('copy-to-output', opts),
});
