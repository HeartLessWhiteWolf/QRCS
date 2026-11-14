import { ImagePipeline } from './image-pipeline.js';
const pipelines = new Map();
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.target !== 'qrcs-offscreen' || sender.id !== chrome.runtime.id) return;
  if (message.type === 'QRCS_STOP_DECODE') { pipelines.get(message.jobId)?.cancel(); respond({ ok: true }); return; }
  if (message.type !== 'QRCS_DECODE_JOB') return;
  const pipeline = new ImagePipeline(); pipelines.set(message.job.id, pipeline);
  pipeline.run(message.job).then(result => respond({ ok: true, ...result }), error => respond({ ok: false, error: error.message }))
    .finally(() => pipelines.delete(message.job.id));
  return true;
});
