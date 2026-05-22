import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const apiKey = process.env.SHORTIO_API_KEY;
    const domain = process.env.SHORTIO_DOMAIN;

    // 1. If Short.io configuration is present, try calling Short.io API
    if (apiKey && domain) {
      try {
        const response = await fetch("https://api.short.io/links", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": apiKey,
            "Accept": "application/json"
          },
          body: JSON.stringify({
            originalURL: url,
            domain: domain,
            allowDuplicates: false
          })
        });

        if (response.ok) {
          const data = await response.json();
          // Short.io returns the full shortened URL in 'shortURL' property
          if (data && data.shortURL) {
            return NextResponse.json({ shortUrl: data.shortURL });
          }
        } else {
          const errorText = await response.text();
          console.error("Short.io API Error Response:", errorText);
        }
      } catch (err) {
        console.error("Short.io API request failed:", err);
      }
    }

    // 2. Fallback to keyless public API (is.gd) for frictionless local development
    try {
      const fallbackResponse = await fetch(
        `https://is.gd/create.php?format=json&url=${encodeURIComponent(url)}`
      );

      if (fallbackResponse.ok) {
        const data = await fallbackResponse.json();
        if (data && data.shorturl) {
          return NextResponse.json({ shortUrl: data.shorturl });
        }
      }
    } catch (err) {
      console.error("is.gd shortening fallback failed:", err);
    }

    // 3. Ultimate fallback: Return the long URL if all shortening attempts fail
    return NextResponse.json({
      shortUrl: url,
      warn: "Shortening services unavailable; returned direct link."
    });
  } catch (error: any) {
    console.error("Shorten API route error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
