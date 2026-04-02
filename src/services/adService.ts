import Constants from "expo-constants";
import { Platform } from "react-native";
import mobileAds, {
  AdEventType,
  InterstitialAd,
  RequestOptions,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from "react-native-google-mobile-ads";

type AdMobExtraConfig = {
  androidBannerUnitId?: string;
  iosBannerUnitId?: string;
  androidInterstitialUnitId?: string;
  iosInterstitialUnitId?: string;
  androidRewardedUnitId?: string;
  iosRewardedUnitId?: string;
};

const requestOptions: RequestOptions = {
  requestNonPersonalizedAdsOnly: true,
};

let initializePromise: Promise<unknown> | null = null;
let interstitial: InterstitialAd | null = null;
let interstitialLoaded = false;
let interstitialLoadPromise: Promise<void> | null = null;

const extraConfig =
  (Constants.expoConfig?.extra?.admob as AdMobExtraConfig | undefined) ?? {};

function resolveUnitId(
  testUnitId: string,
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
  TestIds.BANNER,
  extraConfig.androidBannerUnitId,
  extraConfig.iosBannerUnitId,
);
export const bannerAdsEnabled = bannerAdUnitId !== null;

const interstitialAdUnitId = resolveUnitId(
  TestIds.INTERSTITIAL,
  extraConfig.androidInterstitialUnitId,
  extraConfig.iosInterstitialUnitId,
);
export const interstitialAdsEnabled = interstitialAdUnitId !== null;

const rewardedAdUnitId = resolveUnitId(
  TestIds.REWARDED,
  extraConfig.androidRewardedUnitId,
  extraConfig.iosRewardedUnitId,
);
export const rewardedAdsEnabled = rewardedAdUnitId !== null;

const adsEnabled =
  bannerAdsEnabled || interstitialAdsEnabled || rewardedAdsEnabled;

export function initializeAds() {
  if (!adsEnabled) {
    return Promise.resolve();
  }

  if (!initializePromise) {
    initializePromise = mobileAds()
      .initialize()
      .catch(() => undefined);
  }

  return initializePromise;
}

export async function preloadInterstitialAd() {
  if (!interstitialAdUnitId) {
    return;
  }

  await initializeAds();

  if (interstitial && interstitialLoaded) {
    return;
  }

  if (interstitialLoadPromise) {
    return interstitialLoadPromise;
  }

  interstitial = InterstitialAd.createForAdRequest(
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
      AdEventType.LOADED,
      () => {
        finish(true);
      },
    );

    const unsubscribeError = activeInterstitial.addAdEventListener(
      AdEventType.ERROR,
      () => {
        finish(false);
      },
    );

    fallbackTimer = setTimeout(() => {
      finish(false);
    }, 8000);

    activeInterstitial.load();
  });

  return interstitialLoadPromise;
}

export async function showInterstitialAd() {
  if (!interstitialAdUnitId) {
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
      AdEventType.CLOSED,
      finish,
    );

    const unsubscribeError = readyInterstitial.addAdEventListener(
      AdEventType.ERROR,
      finish,
    );

    void readyInterstitial.show().catch(() => {
      finish();
    });
  });

  void preloadInterstitialAd();
}

export async function showRewardedAd() {
  if (!rewardedAdUnitId) {
    return false;
  }

  const rewardedAd = RewardedAd.createForAdRequest(
    rewardedAdUnitId,
    requestOptions,
  );

  return new Promise<boolean>((resolve) => {
    let earnedReward = false;

    const finish = (didEarnReward: boolean) => {
      unsubscribeLoaded();
      unsubscribeReward();
      unsubscribeClosed();
      unsubscribeError();
      resolve(didEarnReward);
    };

    const unsubscribeLoaded = rewardedAd.addAdEventListener(
      AdEventType.LOADED,
      () => {
        void rewardedAd.show().catch(() => {
          finish(false);
        });
      },
    );

    const unsubscribeReward = rewardedAd.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      () => {
        earnedReward = true;
      },
    );

    const unsubscribeClosed = rewardedAd.addAdEventListener(
      AdEventType.CLOSED,
      () => {
        finish(earnedReward);
      },
    );

    const unsubscribeError = rewardedAd.addAdEventListener(
      AdEventType.ERROR,
      () => {
        finish(false);
      },
    );

    rewardedAd.load();
  });
}
