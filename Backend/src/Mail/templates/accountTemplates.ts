import { button, escapeHtml, heading, layout, note, paragraph } from "../layout";

/** What every template returns: always a plain-text version alongside the HTML. */
export type MailContent = { subject: string; html: string; text: string };

export const verifyEmailTemplate = ({ username, link }: { username: string; link: string }): MailContent => ({
    subject: "Verify your SeatEase email",
    html: layout(
        heading("Confirm your email") +
            paragraph(`Hi ${escapeHtml(username)}, thanks for signing up. Confirm this address to start booking seats.`) +
            button("Verify email", link) +
            note("This link expires in 24 hours. If you didn't create an account, you can ignore this email."),
    ),
    text: [
        `Hi ${username},`,
        "",
        "Thanks for signing up for SeatEase. Confirm your email by opening this link:",
        link,
        "",
        "This link expires in 24 hours. If you didn't create an account, you can ignore this email.",
    ].join("\n"),
});

export const resetPasswordTemplate = ({ username, link }: { username: string; link: string }): MailContent => ({
    subject: "Reset your SeatEase password",
    html: layout(
        heading("Reset your password") +
            paragraph(`Hi ${escapeHtml(username)}, we got a request to reset your password. Choose a new one here:`) +
            button("Choose a new password", link) +
            note("This link expires in 30 minutes and works once. If you didn't ask for this, ignore this email; your password stays the same."),
    ),
    text: [
        `Hi ${username},`,
        "",
        "We got a request to reset your SeatEase password. Choose a new one here:",
        link,
        "",
        "This link expires in 30 minutes and works once. If you didn't ask for this, ignore this email; your password stays the same.",
    ].join("\n"),
});

export const passwordChangedTemplate = ({ username, loginLink }: { username: string; loginLink: string }): MailContent => ({
    subject: "Your SeatEase password was changed",
    html: layout(
        heading("Your password was changed") +
            paragraph(`Hi ${escapeHtml(username)}, the password for your SeatEase account was just changed. Every other device was signed out.`) +
            button("Sign in", loginLink) +
            note("If this wasn't you, reset your password straight away from the sign-in page."),
    ),
    text: [
        `Hi ${username},`,
        "",
        "The password for your SeatEase account was just changed. Every other device was signed out.",
        "",
        `Sign in: ${loginLink}`,
        "",
        "If this wasn't you, reset your password straight away from the sign-in page.",
    ].join("\n"),
});
