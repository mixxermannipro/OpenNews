export interface FeatureFlags {
  liveRadio: boolean;
  clips: boolean;
  dailyBriefing: boolean;
  weeklyReview: boolean;
  cloudTts: boolean;
  pushMonitor: boolean;
  androidAuto: boolean;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  liveRadio: true,
  clips: true,
  dailyBriefing: true,
  weeklyReview: true,
  cloudTts: true,
  pushMonitor: true,
  androidAuto: true,
};

export function resolveFeatureFlags(raw: unknown): FeatureFlags {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_FEATURE_FLAGS };
  const input = raw as Record<string, unknown>;
  return {
    liveRadio: typeof input.liveRadio === 'boolean' ? input.liveRadio : DEFAULT_FEATURE_FLAGS.liveRadio,
    clips: typeof input.clips === 'boolean' ? input.clips : DEFAULT_FEATURE_FLAGS.clips,
    dailyBriefing: typeof input.dailyBriefing === 'boolean' ? input.dailyBriefing : DEFAULT_FEATURE_FLAGS.dailyBriefing,
    weeklyReview: typeof input.weeklyReview === 'boolean' ? input.weeklyReview : DEFAULT_FEATURE_FLAGS.weeklyReview,
    cloudTts: typeof input.cloudTts === 'boolean' ? input.cloudTts : DEFAULT_FEATURE_FLAGS.cloudTts,
    pushMonitor: typeof input.pushMonitor === 'boolean' ? input.pushMonitor : DEFAULT_FEATURE_FLAGS.pushMonitor,
    androidAuto: typeof input.androidAuto === 'boolean' ? input.androidAuto : DEFAULT_FEATURE_FLAGS.androidAuto,
  };
}
