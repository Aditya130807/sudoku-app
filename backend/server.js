const crypto = require("crypto");
const express = require("express");
const Razorpay = require("razorpay");

require("dotenv").config();

const app = express();
const port = Number(process.env.PORT || 5000);

app.use(express.json());

const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

const razorpay =
  razorpayKeyId && razorpayKeySecret
    ? new Razorpay({
        key_id: razorpayKeyId,
        key_secret: razorpayKeySecret,
      })
    : null;

function validateRazorpayConfig(res) {
  if (!razorpay || !razorpayKeySecret) {
    res.status(500).json({
      success: false,
      message:
        "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
    });
    return false;
  }

  return true;
}

app.post("/create-order", async (req, res) => {
  if (!validateRazorpayConfig(res)) {
    return;
  }

  const amount = Number(req.body.amount);
  const currency =
    typeof req.body.currency === "string" ? req.body.currency : "INR";
  const receipt =
    typeof req.body.receipt === "string" && req.body.receipt.trim().length > 0
      ? req.body.receipt.trim()
      : `receipt_${Date.now()}`;

  if (!Number.isInteger(amount) || amount <= 0) {
    console.log("[PAYMENT_DEBUG] CREATE_ORDER_INVALID_AMOUNT", {
      receivedAmount: req.body.amount,
    });
    return res.status(400).json({
      success: false,
      message:
        "amount must be a positive integer in the smallest currency unit (e.g., paise).",
    });
  }

  console.log("[PAYMENT_DEBUG] CREATE_ORDER_REQUEST", {
    amount,
    currency,
    receipt,
  });

  try {
    const order = await razorpay.orders.create({
      amount,
      currency,
      receipt,
    });

    console.log("[PAYMENT_DEBUG] CREATE_ORDER_SUCCESS", {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });

    return res.status(200).json({
      success: true,
      orderId: order.id,
      keyId: razorpayKeyId,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error("Razorpay create order error:", error);
    console.error("[PAYMENT_DEBUG] CREATE_ORDER_FAILED", {
      message: error?.message,
      code: error?.error?.code,
      description: error?.error?.description,
    });
    return res.status(500).json({
      success: false,
      message: "Failed to create Razorpay order.",
    });
  }
});

app.post("/verify-payment", (req, res) => {
  if (!validateRazorpayConfig(res)) {
    return;
  }

  const razorpayOrderId = req.body.razorpay_order_id;
  const razorpayPaymentId = req.body.razorpay_payment_id;
  const razorpaySignature = req.body.razorpay_signature;

  console.log("[PAYMENT_DEBUG] VERIFY_PAYMENT_REQUEST", {
    razorpayOrderId,
    razorpayPaymentId,
    hasSignature: Boolean(razorpaySignature),
  });

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return res.status(400).json({
      success: false,
      message:
        "razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.",
    });
  }

  const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", razorpayKeySecret)
    .update(payload)
    .digest("hex");

  if (expectedSignature === razorpaySignature) {
    console.log("[PAYMENT_DEBUG] VERIFY_PAYMENT_SUCCESS", {
      razorpayOrderId,
      razorpayPaymentId,
    });
    return res.status(200).json({
      success: true,
      message: "Payment signature verified successfully.",
    });
  }

  console.log("[PAYMENT_DEBUG] VERIFY_PAYMENT_FAILED", {
    razorpayOrderId,
    razorpayPaymentId,
  });

  return res.status(400).json({
    success: false,
    message: "Invalid payment signature.",
  });
});

app.listen(port, () => {
  console.log(`Razorpay backend running on http://10.70.74.205:${port}`);
});
