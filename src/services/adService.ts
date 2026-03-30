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

const extraConfig =
  (Constants.expoConfig?.extra?.admob as AdMobExtraConfig | undefined) ?? {};

function resolveUnitId(
  testUnitId: string,
  androidUnitId?: string,
  iosUnitId?: string,
) {
  if (__DEV__) {
    return testUnitId;
  }

  const configuredUnitId =
    Platform.OS === "android" ? androidUnitId : iosUnitId;
  return configuredUnitId && configuredUnitId.trim().length > 0
    ? configuredUnitId
    : testUnitId;
}

export const bannerAdUnitId = resolveUnitId(
  TestIds.BANNER,
  extraConfig.androidBannerUnitId,
  extraConfig.iosBannerUnitId,
);

const interstitialAdUnitId = resolveUnitId(
  TestIds.INTERSTITIAL,
  extraConfig.androidInterstitialUnitId,
  extraConfig.iosInterstitialUnitId,
);

const rewardedAdUnitId = resolveUnitId(
  TestIds.REWARDED,
  extraConfig.androidRewardedUnitId,
  extraConfig.iosRewardedUnitId,
);

export function initializeAds() {
  if (!initializePromise) {
    initializePromise = mobileAds()
      .initialize()
      .catch(() => undefined);
  }

  return initializePromise;
}

export async function showInterstitialAd() {
  const interstitial = InterstitialAd.createForAdRequest(
    interstitialAdUnitId,
    requestOptions,
  );

  await new Promise<void>((resolve) => {
    let resolved = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const complete = () => {
      if (resolved) {
        return;
      }

      resolved = true;
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
      }
      unsubscribeLoaded();
      unsubscribeClosed();
      unsubscribeError();
      resolve();
    };

    const unsubscribeLoaded = interstitial.addAdEventListener(
      AdEventType.LOADED,
      () => {
        void interstitial.show().catch(() => {
          complete();
        });
      },
    );

    const unsubscribeClosed = interstitial.addAdEventListener(
      AdEventType.CLOSED,
      complete,
    );

    const unsubscribeError = interstitial.addAdEventListener(
      AdEventType.ERROR,
      complete,
    );

    fallbackTimer = setTimeout(complete, 2500);
    interstitial.load();
  });
}

export async function showRewardedAd() {
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
