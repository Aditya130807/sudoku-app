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

function getAuthErrorDetailsMessage(error: unknown): string | undefined {
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

export function getAuthErrorMessage(code: string | undefined) {
  switch (code) {
    case "auth/email-already-in-use":
      return "This email is already registered. Please log in instead.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/user-not-found":
      return "No account found with this email.";
    case "auth/wrong-password":
      return "Incorrect password. Please try again.";
    case "auth/invalid-credential":
      return "Invalid email or password.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/network-request-failed":
      return "Network error. Check your internet connection.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export function logAuthError(flow: AuthErrorFlow, error: unknown) {
  void flow;
  void error;
}

export function getGenericAuthErrorMessage(flow: AuthErrorFlow) {
  return GENERIC_AUTH_ERROR_MESSAGES[flow];
}
