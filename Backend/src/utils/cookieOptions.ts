import { isProduction } from "../config/env";

export const authCookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: isProduction,
};
