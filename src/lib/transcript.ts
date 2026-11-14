export const transcriptLimit = 18_000;

export function parseTranscript(input: string, format: string) {
  const lines = input.replace(/^\uFEFF/, '').replace(/\r/g, '').split('\n');
  if (format === 'text/plain') return lines.join('\n').trim().slice(0, transcriptLimit);
  const cues: string[] = [];
  let inCue = false;
  for (const line of lines) {
    if (line.includes('-->')) {
      inCue = true;
    } else if (!line.trim()) {
      inCue = false;
    } else if (inCue) {
      const text = line.replace(/<[^>]+>/g, '').trim();
      if (text && text !== cues.at(-1)) cues.push(text);
    }
  }
  return cues.join('\n').slice(0, transcriptLimit);
}

export function transcriptFormat(type: unknown, url: string) {
  const value = typeof type === 'string' ? type.split(';')[0].trim().toLowerCase() : '';
  if (value === 'text/vtt' || value === 'application/x-subrip' || value === 'text/plain') return value;
  const path = new URL(url).pathname.toLowerCase();
  if (path.endsWith('.vtt')) return 'text/vtt';
  if (path.endsWith('.srt')) return 'application/x-subrip';
  if (path.endsWith('.txt')) return 'text/plain';
}
