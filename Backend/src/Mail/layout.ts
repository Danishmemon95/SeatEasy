/**
 * The shared HTML shell for every mail.
 *
 * Email clients ignore <style> blocks and CSS variables, so this is a table
 * layout with inline styles, and the brand colors are hex copies of the tokens
 * in Frontend/design.md.
 */

const color = {
    paper: "#FBFAF7",
    paperRaised: "#FFFFFF",
    ink: "#1A1815",
    inkSecondary: "#57534E",
    inkMuted: "#8A8580",
    rule: "#E7E3DC",
    accent: "#6B2737",
    accentInk: "#FDFCFB",
};

const serif = "'Iowan Old Style', Georgia, serif";
const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

/** Escapes user-controlled text (usernames, titles) before it goes into HTML. */
export const escapeHtml = (value: string) =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

export const heading = (text: string) =>
    `<h1 style="margin:0 0 16px;font-family:${serif};font-size:24px;font-weight:400;color:${color.ink};">${escapeHtml(text)}</h1>`;

export const paragraph = (html: string) =>
    `<p style="margin:0 0 16px;font-family:${sans};font-size:15px;line-height:1.6;color:${color.inkSecondary};">${html}</p>`;

export const note = (html: string) =>
    `<p style="margin:16px 0 0;font-family:${sans};font-size:13px;line-height:1.5;color:${color.inkMuted};">${html}</p>`;

/** A button, with the raw link underneath for clients that block buttons. */
export const button = (label: string, href: string) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 16px;">
  <tr><td style="border-radius:6px;background:${color.accent};">
    <a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 24px;font-family:${sans};font-size:15px;font-weight:600;color:${color.accentInk};text-decoration:none;">${escapeHtml(label)}</a>
  </td></tr>
</table>
${note(`Or paste this link into your browser:<br><a href="${escapeHtml(href)}" style="color:${color.accent};word-break:break-all;">${escapeHtml(href)}</a>`)}`;

/** Wraps a mail's content in the logo, card and footer. */
export const layout = (content: string) => `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:${color.paper};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${color.paper};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
      <tr><td style="padding:0 0 16px;font-family:${serif};font-size:22px;color:${color.accent};">SeatEase</td></tr>
      <tr><td style="background:${color.paperRaised};border:1px solid ${color.rule};border-radius:8px;padding:32px;">
${content}
      </td></tr>
      <tr><td style="padding:16px 0 0;font-family:${sans};font-size:12px;color:${color.inkMuted};">
        You received this because of activity on your SeatEase account.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
