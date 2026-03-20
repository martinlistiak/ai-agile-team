import { SetMetadata } from "@nestjs/common";
import { SKIP_SUBSCRIPTION_KEY } from "./subscription.constants";

/** Allow route without active/trialing subscription (e.g. billing, accept invite). */
export const SkipSubscriptionCheck = () =>
  SetMetadata(SKIP_SUBSCRIPTION_KEY, true);
