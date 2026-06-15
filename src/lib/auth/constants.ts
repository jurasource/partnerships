// Shared iron-session configuration — imported by both session.ts and middleware.ts
// to guarantee cookieName and other options stay in sync.
export const SESSION_COOKIE_NAME = "fid-session";

export const SESSION_OPTIONS = {
  password: process.env.SESSION_SECRET as string,
  cookieName: SESSION_COOKIE_NAME,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};
