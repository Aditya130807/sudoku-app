# Razorpay Backend

Minimal Express backend for creating and verifying Razorpay payments.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file from `.env.example` and set your Razorpay keys.

3. Start the server:

```bash
npm start
```

Server runs on `http://localhost:5000` by default.

## Endpoints

### `POST /create-order`

Creates a Razorpay order and returns `orderId` plus checkout metadata.

Request body:

```json
{
  "amount": 50000,
  "currency": "INR",
  "receipt": "order_rcptid_11"
}
```

`amount` must be an integer in the smallest unit (for INR, paise).

Success response:

```json
{
  "success": true,
  "orderId": "order_xxxxx",
  "keyId": "rzp_test_xxxxx",
  "amount": 50000,
  "currency": "INR"
}
```

### `POST /verify-payment`

Verifies Razorpay signature using Node `crypto`.

Request body:

```json
{
  "razorpay_order_id": "order_xxxxx",
  "razorpay_payment_id": "pay_xxxxx",
  "razorpay_signature": "generated_signature"
}
```

Success response:

```json
{
  "success": true,
  "message": "Payment signature verified successfully."
}
```
