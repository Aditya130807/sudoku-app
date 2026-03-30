declare module "react-native-razorpay" {
  interface RazorpayCheckoutModule {
    open(options: Record<string, any>): Promise<any>;
  }

  const RazorpayCheckout: RazorpayCheckoutModule;
  export default RazorpayCheckout;
}
