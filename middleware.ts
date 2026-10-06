import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/api/login") ||
    pathname.startsWith("/api/scrape") || // triggered by Vercel Cron, not a browser session
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon");

  if (isPublic) return NextResponse.next();

  const role = await verifySession(req.cookies.get("tg_session")?.value);
  if (!role) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/knowledge") && role !== "lead") {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (pathname.startsWith("/review") && role !== "lead") {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (pathname === "/api/kb" && req.method !== "GET" && role !== "lead") {
    return NextResponse.json({ error: "Team lead access required" }, { status: 403 });
  }
  if (pathname.startsWith("/api/coupons/manage") && role !== "lead") {
    return NextResponse.json({ error: "Team lead access required" }, { status: 403 });
  }
  if (pathname === "/api/kb/note" && role !== "lead") {
    return NextResponse.json({ error: "Team lead access required" }, { status: 403 });
  }
  if (pathname.startsWith("/api/kb/export") && role !== "lead") {
    return NextResponse.json({ error: "Team lead access required" }, { status: 403 });
  }
  if (pathname.startsWith("/api/kb/review") && role !== "lead") {
    return NextResponse.json({ error: "Team lead access required" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
