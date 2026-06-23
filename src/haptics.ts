import { Haptics, ImpactStyle } from '@capacitor/haptics';

const wait = (duration: number) => new Promise(resolve => window.setTimeout(resolve, duration));

function browserVibrate(pattern: number | number[]) {
  if ('vibrate' in navigator) navigator.vibrate(pattern);
}

async function capacitorVibrate(pattern: number | number[]) {
  if (Array.isArray(pattern)) {
    for (let index = 0; index < pattern.length; index += 1) {
      const duration = pattern[index];
      if (index % 2 === 0) await Haptics.vibrate({ duration });
      await wait(duration);
    }
    return;
  }

  if (pattern <= 45) {
    await Haptics.impact({ style: ImpactStyle.Light });
    return;
  }

  if (pattern <= 90) {
    await Haptics.impact({ style: ImpactStyle.Medium });
    return;
  }

  await Haptics.impact({ style: ImpactStyle.Heavy });
}

export function triggerHaptic(enabled: boolean, pattern: number | number[]) {
  if (!enabled) return;

  void capacitorVibrate(pattern).catch(() => {
    browserVibrate(pattern);
  });
}
