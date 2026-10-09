import { env } from "../config/env";
import { sendMail } from "./mailer";
import { passwordChangedTemplate, resetPasswordTemplate, verifyEmailTemplate } from "./templates/accountTemplates";

/**
 * Account mails, called by the auth controller after its database write has
 * succeeded. Each one is fire-and-forget (`void`): the response doesn't wait
 * on Brevo, so a slow send can't stall the request, and an existing account
 * takes the same time to answer as a missing one.
 *
 * Links point at the frontend pages, which call the API themselves.
 */

type Recipient = { username: string; email: string };

export const sendVerificationEmail = (user: Recipient, token: string) => {
    const link = `${env.CLIENT_URL}/verify?token=${token}`;
    void sendMail({ to: user.email, ...verifyEmailTemplate({ username: user.username, link }) });
};

export const sendPasswordResetEmail = (user: Recipient, token: string) => {
    const link = `${env.CLIENT_URL}/reset-password?token=${token}`;
    void sendMail({ to: user.email, ...resetPasswordTemplate({ username: user.username, link }) });
};

export const sendPasswordChangedEmail = (user: Recipient) => {
    const loginLink = `${env.CLIENT_URL}/login`;
    void sendMail({ to: user.email, ...passwordChangedTemplate({ username: user.username, loginLink }) });
};
