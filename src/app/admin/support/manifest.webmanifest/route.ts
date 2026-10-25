export async function GET() {
  return Response.json(
    {
      id: "/admin/support",
      name: "JKTL Support",
      short_name: "JKTL Support",
      start_url: "/admin/support",
      scope: "/",
      display: "standalone",
      background_color: "#020818",
      theme_color: "#112055",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
