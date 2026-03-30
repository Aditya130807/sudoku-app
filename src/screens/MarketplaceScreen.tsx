import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import RazorpayCheckout from "react-native-razorpay";
import { SafeAreaView } from "react-native-safe-area-context";

import CustomButton from "../components/CustomButton";
import Header from "../components/Header";
import { COLORS } from "../constants/colors";
import { useCoins } from "../context/CoinContext";
import { useAppTheme } from "../context/ThemeContext";
import { RootStackParamList } from "../navigation/types";
import { hexToRgba } from "../utils/colorUtils";

type Props = NativeStackScreenProps<RootStackParamList, "Marketplace">;

interface CoinPack {
  id: string;
  coins: number;
  priceInRupees: number;
  highlight?: boolean;
}

interface CreateOrderResponse {
  success: boolean;
  orderId?: string;
  keyId?: string;
  amount?: number;
  currency?: string;
  message?: string;
}

interface VerifyPaymentResponse {
  success: boolean;
  message?: string;
}

interface RazorpayCheckoutSuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

const COIN_PACKS: CoinPack[] = [
  {
    id: "starter",
    coins: 50,
    priceInRupees: 49,
  },
  {
    id: "value",
    coins: 150,
    priceInRupees: 99,
    highlight: true,
  },
  {
    id: "vault",
    coins: 500,
    priceInRupees: 249,
  },
];

const BACKEND_BASE_URL = "http://10.70.74.205:5000";
const PAYMENT_DEBUG_TAG = "[PAYMENT_DEBUG]";

function formatRupees(amount: number) {
  return `\u20B9${amount}`;
}

export default function MarketplaceScreen({ navigation }: Props) {
  const { activeTheme } = useAppTheme();
  const { addCoins, coins, isHydrated } = useCoins();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [processingPackId, setProcessingPackId] = useState<string | null>(null);
  const themeColors = activeTheme.colors;
  const styles = useMemo(
    () => createMarketplaceStyles(themeColors),
    [themeColors],
  );

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timeout = setTimeout(() => {
      setFeedback(null);
    }, 2600);

    return () => {
      clearTimeout(timeout);
    };
  }, [feedback]);

  const createOrder = async (
    coinPack: CoinPack,
  ): Promise<CreateOrderResponse> => {
    const createOrderUrl = `${BACKEND_BASE_URL}/create-order`;
    const createOrderPayload = {
      amount: coinPack.priceInRupees * 100,
      currency: "INR",
      receipt: `coins_${coinPack.id}_${Date.now()}`,
    };

    console.log(`${PAYMENT_DEBUG_TAG} STEP_1_CREATE_ORDER_REQUEST`, {
      url: createOrderUrl,
      payload: createOrderPayload,
    });

    const response = await fetch(createOrderUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createOrderPayload),
    });

    const data = (await response.json()) as CreateOrderResponse;

    console.log(`${PAYMENT_DEBUG_TAG} STEP_1_CREATE_ORDER_RESPONSE`, {
      ok: response.ok,
      status: response.status,
      data,
    });

    if (!response.ok || !data.success || !data.orderId || !data.keyId) {
      const errorMessage = data.message ?? "Unable to create payment order.";
      console.log(`${PAYMENT_DEBUG_TAG} STEP_1_CREATE_ORDER_FAILED`, {
        errorMessage,
        url: createOrderUrl,
      });
      throw new Error(errorMessage);
    }

    return data;
  };

  const verifyPayment = async (
    payload: RazorpayCheckoutSuccess,
  ): Promise<VerifyPaymentResponse> => {
    const verifyUrl = `${BACKEND_BASE_URL}/verify-payment`;

    console.log(`${PAYMENT_DEBUG_TAG} VERIFY_PAYMENT_REQUEST`, {
      url: verifyUrl,
      payload,
    });

    const response = await fetch(verifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as VerifyPaymentResponse;

    console.log(`${PAYMENT_DEBUG_TAG} VERIFY_PAYMENT_RESPONSE`, {
      ok: response.ok,
      status: response.status,
      data,
    });

    if (!response.ok || !data.success) {
      throw new Error(data.message ?? "Payment verification failed.");
    }

    return data;
  };

  const handlePurchase = async (coinPack: CoinPack) => {
    console.log(`${PAYMENT_DEBUG_TAG} STEP_6_BUTTON_CLICKED`, {
      coinPack,
      isHydrated,
      processingPackId,
    });

    if (!isHydrated) {
      console.log(`${PAYMENT_DEBUG_TAG} STEP_6_ABORTED_WALLET_NOT_READY`);
      setFeedback("Your wallet is still loading.");
      return;
    }

    if (processingPackId) {
      console.log(`${PAYMENT_DEBUG_TAG} STEP_6_ABORTED_ALREADY_PROCESSING`, {
        processingPackId,
      });
      return;
    }

    setProcessingPackId(coinPack.id);

    try {
      console.log(`${PAYMENT_DEBUG_TAG} STEP_1_START`);
      const order = await createOrder(coinPack);
      const checkoutOptions = {
        key: order.keyId,
        amount: order.amount ?? coinPack.priceInRupees * 100,
        currency: order.currency ?? "INR",
        name: "Sudoku App",
        description: `${coinPack.coins} Coin Pack`,
        order_id: order.orderId,
        theme: {
          color: COLORS.primary,
        },
      };

      console.log(
        `${PAYMENT_DEBUG_TAG} STEP_2_RAZORPAY_OPTIONS`,
        checkoutOptions,
      );
      console.log(`${PAYMENT_DEBUG_TAG} STEP_3_BEFORE_OPEN`);

      let checkoutResult: RazorpayCheckoutSuccess;
      try {
        checkoutResult = (await RazorpayCheckout.open(
          checkoutOptions,
        )) as RazorpayCheckoutSuccess;
        console.log(
          `${PAYMENT_DEBUG_TAG} STEP_3_AFTER_OPEN_SUCCESS`,
          checkoutResult,
        );
      } catch (openError) {
        console.log(`${PAYMENT_DEBUG_TAG} STEP_3_OPEN_ERROR`, openError);
        throw openError;
      }

      await verifyPayment(checkoutResult);
      addCoins(coinPack.coins);
      setFeedback(`${coinPack.coins} coins added after payment verification.`);
    } catch (error: any) {
      console.log(`${PAYMENT_DEBUG_TAG} STEP_FLOW_ERROR`, error);
      const message =
        error?.description || error?.message || "Payment was not completed.";

      setFeedback(message);
    } finally {
      setProcessingPackId(null);
    }
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Header
          title="Marketplace"
          themeColors={themeColors}
          leftAction={{
            icon: (
              <Ionicons color={themeColors.text} name="arrow-back" size={20} />
            ),
            onPress: () => navigation.goBack(),
          }}
        />

        <View style={styles.walletCard}>
          <Text style={styles.walletLabel}>Wallet</Text>
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={styles.walletValue}
          >
            {isHydrated ? coins : 0} coins
          </Text>
        </View>

        {feedback ? (
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackText}>{feedback}</Text>
          </View>
        ) : null}

        <View style={styles.packList}>
          {COIN_PACKS.map((coinPack) => (
            <View
              key={coinPack.id}
              style={[
                styles.packCard,
                coinPack.highlight ? styles.packCardHighlight : null,
              ]}
            >
              <View style={styles.packHeader}>
                <View style={styles.packCopy}>
                  <Text
                    adjustsFontSizeToFit
                    numberOfLines={1}
                    style={styles.packCoins}
                  >
                    {coinPack.coins} Coins
                  </Text>
                  <Text style={styles.packPrice}>
                    {formatRupees(coinPack.priceInRupees)}
                  </Text>
                </View>

                {coinPack.highlight ? (
                  <View style={styles.highlightBadge}>
                    <Text style={styles.highlightBadgeText}>Best value</Text>
                  </View>
                ) : null}
              </View>

              <CustomButton
                fullWidth
                disabled={!isHydrated || processingPackId !== null}
                label={
                  processingPackId === coinPack.id ? "Processing..." : "Buy"
                }
                onPress={() => {
                  void handlePurchase(coinPack);
                }}
                style={styles.packButton}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createMarketplaceStyles(themeColors: {
  background: string;
  grid: string;
  text: string;
}) {
  const border = hexToRgba(themeColors.text, 0.16);
  const mutedText = hexToRgba(themeColors.text, 0.68);

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    contentContainer: {
      padding: 20,
      paddingBottom: 28,
    },
    walletCard: {
      backgroundColor: themeColors.grid,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: border,
      padding: 16,
    },
    walletLabel: {
      color: mutedText,
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    walletValue: {
      color: themeColors.text,
      fontSize: 30,
      fontWeight: "900",
      marginTop: 8,
      flexShrink: 1,
    },
    feedbackCard: {
      marginTop: 14,
      borderRadius: 16,
      padding: 16,
      backgroundColor: COLORS.primarySoft,
    },
    feedbackText: {
      color: COLORS.primaryDark,
      fontSize: 13,
      fontWeight: "700",
    },
    packList: {
      gap: 14,
      marginTop: 16,
    },
    packCard: {
      backgroundColor: themeColors.grid,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: border,
      padding: 16,
    },
    packCardHighlight: {
      borderColor: COLORS.primary,
      shadowColor: hexToRgba(COLORS.primary, 0.28),
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.14,
      shadowRadius: 18,
      elevation: 5,
    },
    packHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
      alignItems: "center",
    },
    packCopy: {
      flex: 1,
      minWidth: 0,
    },
    packCoins: {
      color: themeColors.text,
      fontSize: 24,
      fontWeight: "900",
      flexShrink: 1,
    },
    packPrice: {
      color: COLORS.primary,
      fontSize: 16,
      fontWeight: "800",
      marginTop: 6,
    },
    highlightBadge: {
      backgroundColor: COLORS.primarySoft,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    highlightBadgeText: {
      color: COLORS.primaryDark,
      fontSize: 12,
      fontWeight: "800",
    },
    packButton: {
      marginTop: 14,
    },
  });
}
