import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { NativeModules, Platform } from "react-native";

type AdsModule = any;

type AdMobExtraConfig = {
  androidBannerUnitId?: string;
  iosBannerUnitId?: string;
  androidInterstitialUnitId?: string;
  iosInterstitialUnitId?: string;
  androidRewardedUnitId?: string;
  iosRewardedUnitId?: string;
};

type AdRequestOptions = {
  requestNonPersonalizedAdsOnly: boolean;
};

const requestOptions: AdRequestOptions = {
  requestNonPersonalizedAdsOnly: true,
};

const AD_CONSENT_STATUS_KEY = "@sudoku_ryve/ad_consent_status";
const CONSENT_INIT_TIMEOUT_MS = 5000;

let initializePromise: Promise<unknown> | null = null;
let consentInitializePromise: Promise<number | null> | null = null;
let safeConsentInitializePromise: Promise<number | null> | null = null;
let consentResolved = false;
let latestConsentStatus: number | null = null;
let interstitial: any = null;
let interstitialLoaded = false;
let interstitialLoadPromise: Promise<void> | null = null;
let rewardedAd: any = null;
export let isRewardedLoaded = false;
let rewardedLoadPromise: Promise<void> | null = null;
let cachedAdsModule: AdsModule | null | undefined;
const rewardedStateListeners = new Set<(loaded: boolean) => void>();

function notifyRewardedStateChanged() {
  rewardedStateListeners.forEach((listener) => {
    listener(isRewardedLoaded);
  });
}

export function subscribeRewardedAdState(listener: (loaded: boolean) => void) {
  rewardedStateListeners.add(listener);
  listener(isRewardedLoaded);

  return () => {
    rewardedStateListeners.delete(listener);
  };
}

export function isAdConsentResolved() {
  return consentResolved;
}

export function getAdRequestOptions(): AdRequestOptions {
  return {
    requestNonPersonalizedAdsOnly: requestOptions.requestNonPersonalizedAdsOnly,
  };
}

function getAdsModule(): AdsModule | null {
  if (cachedAdsModule !== undefined) {
    return cachedAdsModule;
  }

  // In Expo Go or misconfigured builds, this native module may not be linked.
  if (!NativeModules.RNGoogleMobileAdsModule) {
    cachedAdsModule = null;
    return cachedAdsModule;
  }

  let ads: AdsModule | null = null;

  try {
    ads = require("react-native-google-mobile-ads") as AdsModule;
  } catch {
    ads = null;
  }

  if (!ads) {
    cachedAdsModule = null;
    return cachedAdsModule;
  }

  cachedAdsModule = ads;

  return cachedAdsModule;
}

const extraConfig =
  (Constants.expoConfig?.extra?.admob as AdMobExtraConfig | undefined) ?? {};

const DEV_TEST_IDS = {
  BANNER: "ca-app-pub-3940256099942544/6300978111",
  INTERSTITIAL: "ca-app-pub-3940256099942544/1033173712",
  REWARDED: "ca-app-pub-3940256099942544/5224354917",
} as const;

function resolveUnitId(
  testUnitId: string | null,
  androidUnitId?: string,
  iosUnitId?: string,
): string | null {
  if (__DEV__) {
    return testUnitId;
  }

  const configuredUnitId =
    Platform.OS === "android" ? androidUnitId : iosUnitId;
  return configuredUnitId && configuredUnitId.trim().length > 0
    ? configuredUnitId
    : null;
}

export const bannerAdUnitId = resolveUnitId(
  DEV_TEST_IDS.BANNER,
  extraConfig.androidBannerUnitId,
  extraConfig.iosBannerUnitId,
);
export const bannerAdsEnabled = bannerAdUnitId !== null;

const interstitialAdUnitId = resolveUnitId(
  DEV_TEST_IDS.INTERSTITIAL,
  extraConfig.androidInterstitialUnitId,
  extraConfig.iosInterstitialUnitId,
);
export const interstitialAdsEnabled = interstitialAdUnitId !== null;

const rewardedAdUnitId = resolveUnitId(
  DEV_TEST_IDS.REWARDED,
  extraConfig.androidRewardedUnitId,
  extraConfig.iosRewardedUnitId,
);
export const rewardedAdsEnabled = rewardedAdUnitId !== null;

const adsEnabled =
  bannerAdsEnabled || interstitialAdsEnabled || rewardedAdsEnabled;

async function readStoredConsentStatus(): Promise<number | null> {
  try {
    const storedStatus = await AsyncStorage.getItem(AD_CONSENT_STATUS_KEY);

    if (!storedStatus) {
      return null;
    }

    const parsedStatus = Number(storedStatus);
    return Number.isFinite(parsedStatus) ? parsedStatus : null;
  } catch {
    return null;
  }
}

async function persistConsentStatus(status: number | null) {
  if (typeof status !== "number" || !Number.isFinite(status)) {
    return;
  }

  try {
    await AsyncStorage.setItem(AD_CONSENT_STATUS_KEY, String(status));
  } catch {
    // Keep ad setup stable even if consent status persistence fails.
  }
}

async function applyConsentAwareRequestConfiguration(
  activeAdsModule: AdsModule,
  status: number | null,
) {
  const obtainedStatus = activeAdsModule.AdsConsentStatus?.OBTAINED;
  const requestNonPersonalizedAdsOnly = status !== obtainedStatus;

  requestOptions.requestNonPersonalizedAdsOnly = requestNonPersonalizedAdsOnly;

  try {
    await activeAdsModule.default().setRequestConfiguration({
      requestNonPersonalizedAdsOnly,
    });
  } catch {
    // Keep ad loading resilient if request configuration cannot be applied.
  }
}

export async function initializeAdConsent() {
  const activeAdsModule = getAdsModule();

  if (!adsEnabled || !activeAdsModule) {
    consentResolved = true;
    return null;
  }

  if (consentInitializePromise) {
    return consentInitializePromise;
  }

  consentInitializePromise = (async () => {
    let nextConsentStatus = await readStoredConsentStatus();
    const consentApi = activeAdsModule.AdsConsent;
    const consentStatusApi = activeAdsModule.AdsConsentStatus;

    try {
      const consentInfo =
        typeof consentApi?.requestInfoUpdate === "function"
          ? await consentApi.requestInfoUpdate()
          : null;

      if (
        consentInfo?.status === consentStatusApi?.REQUIRED &&
        typeof consentApi?.showForm === "function"
      ) {
        await consentApi.showForm();
      }

      if (typeof consentApi?.getConsentStatus === "function") {
        nextConsentStatus = await consentApi.getConsentStatus();
      }
    } catch (error) {
      console.warn("Ad consent initialization failed", error);
    }

    latestConsentStatus =
      typeof nextConsentStatus === "number" &&
      Number.isFinite(nextConsentStatus)
        ? nextConsentStatus
        : latestConsentStatus;

    await applyConsentAwareRequestConfiguration(
      activeAdsModule,
      latestConsentStatus,
    );
    await persistConsentStatus(latestConsentStatus);

    consentResolved = true;
    return latestConsentStatus;
  })();

  return consentInitializePromise;
}

async function initializeConsentWithTimeout() {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error("Consent timeout"));
    }, CONSENT_INIT_TIMEOUT_MS);
  });

  try {
    return await Promise.race([initializeAdConsent(), timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function applyConsentFallbackConfiguration(
  activeAdsModule: AdsModule | null,
) {
  requestOptions.requestNonPersonalizedAdsOnly = true;

  if (!activeAdsModule) {
    return;
  }

  try {
    await activeAdsModule.default().setRequestConfiguration({
      requestNonPersonalizedAdsOnly: true,
    });
  } catch {
    // Keep ad setup stable if fallback request configuration fails.
  }
}

export async function safeInitializeConsent() {
  if (safeConsentInitializePromise) {
    return safeConsentInitializePromise;
  }

  safeConsentInitializePromise = (async () => {
    const activeAdsModule = getAdsModule();

    try {
      return await initializeConsentWithTimeout();
    } catch (error) {
      console.warn("CONSENT_INIT_FAILED", error);
      await applyConsentFallbackConfiguration(activeAdsModule);
      return latestConsentStatus;
    } finally {
      consentResolved = true;
    }
  })();

  return safeConsentInitializePromise;
}

export function initializeAds() {
  const activeAdsModule = getAdsModule();

  if (!adsEnabled || !activeAdsModule) {
    return Promise.resolve();
  }

  if (!initializePromise) {
    initializePromise = (async () => {
      await safeInitializeConsent();

      if (!consentResolved) {
        return undefined;
      }

      return activeAdsModule.default().initialize();
    })().catch(() => undefined);
  }

  return initializePromise;
}

export async function preloadInterstitialAd() {
  const activeAdsModule = getAdsModule();

  if (!interstitialAdUnitId || !activeAdsModule) {
    return;
  }

  await initializeAds();

  if (!consentResolved) {
    return;
  }

  if (interstitial && interstitialLoaded) {
    return;
  }

  if (interstitialLoadPromise) {
    return interstitialLoadPromise;
  }

  interstitial = activeAdsModule.InterstitialAd.createForAdRequest(
    interstitialAdUnitId,
    requestOptions,
  );
  const activeInterstitial = interstitial;

  if (!activeInterstitial) {
    return;
  }

  interstitialLoadPromise = new Promise<void>((resolve) => {
    let settled = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const finish = (didLoad: boolean) => {
      if (settled) {
        return;
      }

      settled = true;
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
      }

      unsubscribeLoaded();
      unsubscribeError();
      interstitialLoaded = didLoad && interstitial === activeInterstitial;

      if (!interstitialLoaded && interstitial === activeInterstitial) {
        interstitial = null;
      }

      interstitialLoadPromise = null;
      resolve();
    };

    const unsubscribeLoaded = activeInterstitial.addAdEventListener(
      activeAdsModule.AdEventType.LOADED,
      () => {
        finish(true);
      },
    );

    const unsubscribeError = activeInterstitial.addAdEventListener(
      activeAdsModule.AdEventType.ERROR,
      () => {
        finish(false);
      },
    );

    fallbackTimer = setTimeout(() => {
      finish(false);
    }, 5000);

    activeInterstitial.load();
  });

  return interstitialLoadPromise;
}

export async function showInterstitialAd() {
  const activeAdsModule = getAdsModule();

  if (!interstitialAdUnitId || !activeAdsModule) {
    return;
  }

  if (!consentResolved) {
    await initializeAds();
  }

  if (!consentResolved) {
    return;
  }

  await preloadInterstitialAd();

  const activeInterstitial = interstitial;

  if (!activeInterstitial || !interstitialLoaded) {
    return;
  }
  const readyInterstitial = activeInterstitial;

  interstitial = null;
  interstitialLoaded = false;
  interstitialLoadPromise = null;

  await new Promise<void>((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      unsubscribeClosed();
      unsubscribeError();
      resolve();
    };

    const unsubscribeClosed = readyInterstitial.addAdEventListener(
      activeAdsModule.AdEventType.CLOSED,
      finish,
    );

    const unsubscribeError = readyInterstitial.addAdEventListener(
      activeAdsModule.AdEventType.ERROR,
      finish,
    );

    void readyInterstitial.show().catch(() => {
      finish();
    });
  });

  void preloadInterstitialAd().catch(() => {
    // Keep gameplay flow stable if ad preloading fails.
  });
}

export async function preloadRewardedAd() {
  const activeAdsModule = getAdsModule();

  if (!rewardedAdUnitId || !activeAdsModule) {
    return;
  }

  await initializeAds();

  if (!consentResolved) {
    return;
  }

  if (rewardedAd && isRewardedLoaded) {
    return;
  }

  if (rewardedLoadPromise) {
    return rewardedLoadPromise;
  }

  if (!rewardedAd) {
    rewardedAd = activeAdsModule.RewardedAd.createForAdRequest(
      rewardedAdUnitId,
      requestOptions,
    );
  }

  const activeRewardedAd = rewardedAd;

  if (!activeRewardedAd) {
    return;
  }

  rewardedLoadPromise = new Promise<void>((resolve) => {
    let settled = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let unsubscribeClosed = () => {};

    const finish = (didLoad: boolean) => {
      if (settled) {
        return;
      }

      settled = true;

      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
      }

      unsubscribeLoaded();
      unsubscribeError();
      if (!didLoad) {
        unsubscribeClosed();
      }

      isRewardedLoaded = didLoad && rewardedAd === activeRewardedAd;
      notifyRewardedStateChanged();

      if (!isRewardedLoaded && rewardedAd === activeRewardedAd) {
        rewardedAd = null;
      }

      rewardedLoadPromise = null;
      resolve();
    };

    const unsubscribeLoaded = activeRewardedAd.addAdEventListener(
      activeAdsModule.RewardedAdEventType.LOADED,
      () => {
        finish(true);
      },
    );

    const unsubscribeError = activeRewardedAd.addAdEventListener(
      activeAdsModule.AdEventType.ERROR,
      (error: any) => {
        console.error("Rewarded ad failed to load:", error);

        finish(false);
      },
    );

    unsubscribeClosed = activeRewardedAd.addAdEventListener(
      activeAdsModule.AdEventType.CLOSED,
      () => {
        if (rewardedAd !== activeRewardedAd) {
          return;
        }

        isRewardedLoaded = false;
        notifyRewardedStateChanged();
        rewardedAd = null;
        rewardedLoadPromise = null;
      },
    );

    fallbackTimer = setTimeout(() => {
      finish(false);
    }, 8000);

    activeRewardedAd.load();
  });

  return rewardedLoadPromise;
}

export async function showRewardedAd() {
  const activeAdsModule = getAdsModule();

  if (!rewardedAdUnitId || !activeAdsModule) {
    return false;
  }

  if (!consentResolved) {
    await initializeAds();
  }

  if (!consentResolved) {
    return false;
  }

  const activeRewardedAd = rewardedAd;

  if (!activeRewardedAd || !isRewardedLoaded) {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    let earnedReward = false;
    let settled = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const finish = (didEarnReward: boolean) => {
      if (settled) {
        return;
      }

      settled = true;
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
      }
      unsubscribeReward();
      unsubscribeClosed();
      unsubscribeError();
      resolve(didEarnReward);
    };

    const unsubscribeReward = activeRewardedAd.addAdEventListener(
      activeAdsModule.RewardedAdEventType.EARNED_REWARD,
      () => {
        earnedReward = true;
      },
    );

    const unsubscribeClosed = activeRewardedAd.addAdEventListener(
      activeAdsModule.AdEventType.CLOSED,
      () => {
        finish(earnedReward);
      },
    );

    const unsubscribeError = activeRewardedAd.addAdEventListener(
      activeAdsModule.AdEventType.ERROR,
      (error: unknown) => {
        console.error("Rewarded ad runtime error:", error);
        finish(false);
      },
    );

    fallbackTimer = setTimeout(() => {
      finish(false);
    }, 7000);

    void activeRewardedAd.show().catch(() => {
      finish(false);
    });
  });
}
