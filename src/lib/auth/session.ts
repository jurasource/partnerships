// Requires SESSION_SECRET in .env.local — generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";
import { SESSION_OPTIONS } from "./constants";

export interface SessionData {
  isAuthenticated?: boolean;
}

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), SESSION_OPTIONS);
}

export async function setSession(): Promise<void> {
  const session = await getSession();
  session.isAuthenticated = true;
  await session.save();
}

export async function clearSession(): Promise<void> {
  const session = await getSession();
  session.destroy();
}
