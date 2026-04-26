import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";

export type SessionData = {
  userId?: string;
  name?: string;
  role?: "member" | "admin";
};

const password = process.env.SESSION_SECRET;
if (!password || password.length < 32) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET muss mindestens 32 Zeichen lang sein.");
  }
}

export const sessionOptions: SessionOptions = {
  password: password ?? "dev-only-fallback-secret-bitte-in-prod-setzen-32",
  cookieName: "drinks_session",
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 Tage
  },
};

export async function getSession() {
  const store = await cookies();
  return getIronSession<SessionData>(store, sessionOptions);
}

export async function requireUser() {
  const session = await getSession();
  if (!session.userId) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireUser();
  if (session.role !== "admin") {
    throw new Response("Forbidden", { status: 403 });
  }
  return session;
}
