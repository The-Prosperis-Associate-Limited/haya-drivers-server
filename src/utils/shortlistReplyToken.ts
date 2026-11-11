import crypto from "crypto";
import jwt, { type Secret } from "jsonwebtoken";

const { SHORTLIST_REPLY_SECRET, ACCESS_TOKEN_SECRET } = process.env;

const PURPOSE = "shortlist-reply";

// Derived, never the raw access secret, so a reply token can never pass as a session.
const secret = (): Secret => SHORTLIST_REPLY_SECRET || crypto.createHmac("sha256", ACCESS_TOKEN_SECRET as string).update(PURPOSE).digest("hex");

// Outlives respond_by on purpose, so a late click is told the invitation expired rather than that the link is broken.
export const signShortlistReplyToken = (assignmentId: string) => jwt.sign({ aid: assignmentId, purpose: PURPOSE }, secret(), { expiresIn: "30d" });

export const readShortlistReplyToken = (token: string): string | null => {
  try {
    const payload = jwt.verify(token, secret()) as { aid?: string; purpose?: string };

    return payload.purpose === PURPOSE && payload.aid ? payload.aid : null;
  } catch {
    return null;
  }
};
