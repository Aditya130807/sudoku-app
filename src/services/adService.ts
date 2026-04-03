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

let initializePromise: Promise<unknown> | null = null;
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

export function initializeAds() {
  const activeAdsModule = getAdsModule();

  if (!adsEnabled || !activeAdsModule) {
    return Promise.resolve();
  }

  if (!initializePromise) {
    initializePromise = activeAdsModule
      .default()
      .initialize()
      .catch(() => undefined);
  }

  return initializePromise;
}

export async function preloadInterstitialAd() {
  const activeAdsModule = getAdsModule();

  if (!interstitialAdUnitId || !activeAdsModule) {
    return;
  }

  await initializeAds();

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
        console.log("Ad error:", error);
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

  const activeRewardedAd = rewardedAd;

  if (!activeRewardedAd || !isRewardedLoaded) {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    let earnedReward = false;
    let settled = false;

    const finish = (didEarnReward: boolean) => {
      if (settled) {
        return;
      }

      settled = true;
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
        console.log("Ad error:", error);
        console.error("Rewarded ad runtime error:", error);
        finish(false);
      },
    );

    void activeRewardedAd.show().catch(() => {
      finish(false);
    });
  });
}
