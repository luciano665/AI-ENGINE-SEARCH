// TODO: Implement the code here to add rate limiting with Redis
// Refer to the Next.js Docs: https://nextjs.org/docs/app/building-your-application/routing/middleware
// Refer to Redis docs on Rate Limiting: https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms

import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import {headers} from 'next/headers';
import {Ratelimit} from "@upstash/ratelimit";
import {Redis} from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
  analytics: true,
  timeout: 10000,
});

export async function middleware(request: NextRequest) {
  try {

    //We need a client identifier in order have an account of limits per user
    const headerList = headers();
    const fowardedFor = (await headerList).get('x-forwarded-for');
    const clientIdentifer = fowardedFor ? fowardedFor.split(",")[0] : 'Unknowns';

    //check the rate limmit
    const {success, remaining, reset} = await ratelimit.limit(clientIdentifer);

    if(!success){
      //Respond with 429: to many requests -> error if exceeded rate limit
      return new NextResponse(
        JSON.stringify({
          error: "Rate limit exceeded. Please try again later",
          retryAfter: reset,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": reset.toString(), //Retry after in senconds (send)
          },
        }
      );
    }
    //Headers to inform the client of their remaining limit
    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Limit", "10");
    response.headers.set("X-RateLimit-Remaining", remaining.toString());
    response.headers.set("X-Limit-Reset", reset.toString());

    return response;
  } catch (error) {
    console.error("Rate limiting error", error);
    return new NextResponse(
      JSON.stringify({error: "Internal server error"}),
      {status: 500, headers: {"Content-Type": "application/json"}}
    )
  }
}


// Configure which paths the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except static files and images
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
    "/api/:path*",
  ],
};
