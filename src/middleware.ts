import { authMiddleware, withAuth } from "@kinde-oss/kinde-auth-nextjs/server"
import { NextRequest } from "next/server";

export const config = {
    matcher: ["/dashboard/:path*" , "/auth-callback"]
}

export default function middleware(req: NextRequest) {
    return withAuth(req);
}