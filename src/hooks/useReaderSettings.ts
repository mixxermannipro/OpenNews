import { useCallback } from 'react';
import {
  upsertAudioPosition,
  upsertReadingProgress,
  type ArticleHighlight,
  type AudioPositionEntry,
  type ReaderSurfaceTheme,
  type ReadingProgressEntry,
} from '../lib/readerExtras';
import type { ReaderFontFamily, ReaderFontSize } from '../types/news';
import { useLocalStorage } from './useLocalStorage';

export function useReaderSettings() {
  const [fontSize, setFontSize] = useLocalStorage<ReaderFontSize>('opennews_font_size', 'normal');
  const [fontFamily, setFontFamily] = useLocalStorage<ReaderFontFamily>('opennews_font_family', 'sans');
  const [readerTheme, setReaderTheme] = useLocalStorage<ReaderSurfaceTheme>('opennews_reader_theme', 'paper');
  const [newspaperMode, setNewspaperMode] = useLocalStorage<boolean>('opennews_newspaper_mode', false);
  const [highlights, setHighlights] = useLocalStorage<ArticleHighlight[]>('opennews_highlights', []);
  const [readingQueueIds, setReadingQueueIds] = useLocalStorage<string[]>('opennews_reading_queue', []);
  const [readingProgress, setReadingProgress] = useLocalStorage<Record<string, ReadingProgressEntry>>(
    'opennews_reading_progress',
    {},
  );
  const [audioPositions, setAudioPositions] = useLocalStorage<Record<string, AudioPositionEntry>>(
    'opennews_audio_positions',
    {},
  );

  const saveReadingProgress = useCallback((articleId: string, ratio: number) => {
    setReadingProgress(prev => upsertReadingProgress(prev, articleId, ratio));
  }, [setReadingProgress]);

  const saveAudioPosition = useCallback((url: string, seconds: number, duration: number) => {
    setAudioPositions(prev => upsertAudioPosition(prev, url, seconds, duration));
  }, [setAudioPositions]);

  return {
    fontSize,
    setFontSize,
    fontFamily,
    setFontFamily,
    readerTheme,
    setReaderTheme,
    newspaperMode,
    setNewspaperMode,
    highlights,
    setHighlights,
    readingQueueIds,
    setReadingQueueIds,
    readingProgress,
    audioPositions,
    saveReadingProgress,
    saveAudioPosition,
  };
}
