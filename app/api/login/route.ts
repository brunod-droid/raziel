import { NextRequest, NextResponse } from "next/server";
import { checkPasscode, signSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { passcode } = await req.json();
  const role = checkPasscode(String(passcode || ""));
  if (!role) {
    return NextResponse.json({ error: "Incorrect passcode" }, { status: 401 });
  }
  const res = NextResponse.json({ role });
  res.cookies.set("tg_session", await signSession(role), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
