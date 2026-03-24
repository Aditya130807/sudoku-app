export type AuthErrorFlow = "login" | "signup" | "forgot-password";

const GENERIC_AUTH_ERROR_MESSAGES: Record<AuthErrorFlow, string> = {
  login: "Unable to sign in. Please try again.",
  signup: "Unable to create your account. Please try again.",
  "forgot-password": "Unable to process your request. Please try again.",
};

export const FORGOT_PASSWORD_REQUEST_MESSAGE =
  "If an account exists for that email, a reset link has been sent.";

export function getAuthErrorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return undefined;
}

export function getAuthErrorMessage(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return undefined;
}

export function logAuthError(flow: AuthErrorFlow, error: unknown) {
  console.warn(`[auth:${flow}]`, {
    code: getAuthErrorCode(error) ?? "unknown",
    message: getAuthErrorMessage(error) ?? "unknown",
  });
}

export function getGenericAuthErrorMessage(flow: AuthErrorFlow) {
  return GENERIC_AUTH_ERROR_MESSAGES[flow];
}
