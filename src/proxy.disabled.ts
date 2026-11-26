import { NextResponse, type NextRequest } from "next/server"

import { DRIVER_COOKIE, verifyDriverSession } from "@/lib/driver-session"

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (!pathname.startsWith("/driver")) return NextResponse.next()

  const signedIn = await verifyDriverSession(request.cookies.get(DRIVER_COOKIE)?.value)
  const login = pathname === "/driver/login"

  if (login && signedIn) {
    return NextResponse.redirect(new URL("/driver", request.url))
  }
  if (!login && !signedIn) {
    return NextResponse.redirect(new URL("/driver/login", request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/driver", "/driver/:path*"],
}
