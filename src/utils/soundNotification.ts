import {
  getSoundPingAcousticProfile,
  normalizeOrderStatusForSoundTrigger,
  type SoundNotificationTrigger,
} from '../core/escrowEngine';

const SOUND_PREF_STORAGE_KEY = 'costorah_sound_notifications_enabled';

let sharedAudioContext: AudioContext | null = null;

function getOrCreateAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;

  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    try {
      sharedAudioContext = new AudioCtx();
    } catch {
      return null;
    }
  }
  return sharedAudioContext;
}

/**
 * Reads user preference for browser sound notifications from localStorage (defaults to enabled).
 */
export function isSoundNotificationEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(SOUND_PREF_STORAGE_KEY);
    if (raw === null) return true;
    return raw !== 'false';
  } catch {
    return true;
  }
}

/**
 * Persists user preference for browser sound notifications in localStorage.
 */
export function setSoundNotificationEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SOUND_PREF_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore storage errors
  }
}

/**
 * Plays a subtle, institutional acoustic 'ping' tone in the browser using Web Audio API
 * when an order status transitions to 'PENDING_PAYMENT' ('PAYMENT_PENDING') or 'TRADE_COMPLETED' ('COMPLETED').
 */
export function playOrderStatusPing(
  statusOrTrigger: SoundNotificationTrigger | string,
  options?: { forcePlayWhenMuted?: boolean }
): boolean {
  if (!options?.forcePlayWhenMuted && !isSoundNotificationEnabled()) {
    return false;
  }

  const trigger = normalizeOrderStatusForSoundTrigger(statusOrTrigger);
  if (!trigger) {
    return false;
  }

  const ctx = getOrCreateAudioContext();
  if (!ctx) return false;

  try {
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {
        // Ignore autoplay restriction if no prior gesture
      });
    }

    const profile = getSoundPingAcousticProfile(trigger);
    const now = ctx.currentTime;
    const durationSec = profile.durationMs / 1000;

    // Master envelope gain node with soft attack and natural exponential decay
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.linearRampToValueAtTime(profile.peakGain, now + 0.012);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
    masterGain.connect(ctx.destination);

    // Primary sine oscillator (warm fundamental ping)
    const primaryOsc = ctx.createOscillator();
    primaryOsc.type = 'sine';
    primaryOsc.frequency.setValueAtTime(profile.primaryFrequencyHz, now);
    if (trigger === 'TRADE_COMPLETED') {
      // Subtle upward harmonic glide for completion
      primaryOsc.frequency.setValueAtTime(profile.primaryFrequencyHz, now);
      primaryOsc.frequency.exponentialRampToValueAtTime(
        profile.overtoneFrequencyHz,
        now + Math.min(0.09, durationSec * 0.35)
      );
    }
    primaryOsc.connect(masterGain);
    primaryOsc.start(now);
    primaryOsc.stop(now + durationSec + 0.02);

    // Harmonic overtone oscillator (subtle crystalline bell shimmer)
    const overtoneGain = ctx.createGain();
    overtoneGain.gain.setValueAtTime(0.0001, now);
    overtoneGain.gain.linearRampToValueAtTime(profile.peakGain * 0.38, now + 0.008);
    overtoneGain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec * 0.78);
    overtoneGain.connect(ctx.destination);

    const overtoneOsc = ctx.createOscillator();
    overtoneOsc.type = 'triangle';
    overtoneOsc.frequency.setValueAtTime(
      trigger === 'TRADE_COMPLETED' ? profile.shimmerFrequencyHz : profile.overtoneFrequencyHz,
      now
    );
    overtoneOsc.connect(overtoneGain);
    overtoneOsc.start(now);
    overtoneOsc.stop(now + durationSec * 0.8 + 0.02);

    return true;
  } catch {
    return false;
  }
}
