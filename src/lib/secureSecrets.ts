import { Capacitor, registerPlugin } from '@capacitor/core';

const SAFE_SECRET_KEY = /^[a-zA-Z0-9._-]{1,64}$/;

const SecureSecretsPlugin = registerPlugin<{
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
}>('SecureSecrets');

export function isSecureSecretsSupported(): boolean {
  return Capacitor.getPlatform() === 'android';
}

export async function getSecureSecret(key: string): Promise<string | null> {
  if (!isSecureSecretsSupported() || !SAFE_SECRET_KEY.test(key)) return null;
  try {
    const res = await SecureSecretsPlugin.get({ key });
    return typeof res?.value === 'string' && res.value.length > 0 ? res.value : null;
  } catch {
    return null;
  }
}

export async function setSecureSecret(key: string, value: string): Promise<boolean> {
  if (!isSecureSecretsSupported() || !SAFE_SECRET_KEY.test(key)) return false;
  try {
    await SecureSecretsPlugin.set({ key, value });
    return true;
  } catch {
    return false;
  }
}

export async function removeSecureSecret(key: string): Promise<void> {
  if (!isSecureSecretsSupported() || !SAFE_SECRET_KEY.test(key)) return;
  try {
    await SecureSecretsPlugin.remove({ key });
  } catch {
    // Ignore cleanup errors cleanly
  }
}
