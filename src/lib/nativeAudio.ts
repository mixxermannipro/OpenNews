import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface NativeAudioPlaybackState {
  url: string;
  playing: boolean;
  buffering: boolean;
  currentTime: number;
  duration: number;
  ended: boolean;
  error: boolean;
}

export interface NativePlayOptions {
  url: string;
  title: string;
  artist: string;
  artworkUrl?: string;
  isLive?: boolean;
  initialSeconds?: number;
  speed?: number;
  stationId?: string;
}

const NativeAudioPlayerPlugin = registerPlugin<{
  play(options: NativePlayOptions): Promise<NativeAudioPlaybackState>;
  pause(): Promise<NativeAudioPlaybackState>;
  resume(): Promise<NativeAudioPlaybackState>;
  stop(): Promise<void>;
  seekTo(options: { seconds: number }): Promise<NativeAudioPlaybackState>;
  seekBy(options: { deltaSeconds: number }): Promise<NativeAudioPlaybackState>;
  setSpeed(options: { speed: number }): Promise<NativeAudioPlaybackState>;
  getState(): Promise<NativeAudioPlaybackState>;
  addListener(
    event: 'playbackState',
    listener: (state: NativeAudioPlaybackState) => void,
  ): Promise<PluginListenerHandle>;
}>('NativeAudioPlayer');

export function isNativeAudioAvailable(): boolean {
  return Capacitor.getPlatform() === 'android';
}

export function playNativeAudio(options: NativePlayOptions): Promise<NativeAudioPlaybackState> {
  return NativeAudioPlayerPlugin.play(options);
}

export function pauseNativeAudio(): Promise<NativeAudioPlaybackState> {
  return NativeAudioPlayerPlugin.pause();
}

export function resumeNativeAudio(): Promise<NativeAudioPlaybackState> {
  return NativeAudioPlayerPlugin.resume();
}

export function stopNativeAudio(): Promise<void> {
  return NativeAudioPlayerPlugin.stop();
}

export function seekNativeAudio(seconds: number): Promise<NativeAudioPlaybackState> {
  return NativeAudioPlayerPlugin.seekTo({ seconds });
}

export function seekNativeAudioBy(deltaSeconds: number): Promise<NativeAudioPlaybackState> {
  return NativeAudioPlayerPlugin.seekBy({ deltaSeconds });
}

export function setNativeAudioSpeed(speed: number): Promise<NativeAudioPlaybackState> {
  return NativeAudioPlayerPlugin.setSpeed({ speed });
}

export function addNativeAudioListener(
  listener: (state: NativeAudioPlaybackState) => void,
): Promise<PluginListenerHandle> {
  return NativeAudioPlayerPlugin.addListener('playbackState', listener);
}
