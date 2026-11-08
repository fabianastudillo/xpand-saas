import Link from "next/link";

// Unknown addresses (the app has two root layouts, so there is no layout to wrap the default 404). Self-contained:
// its own document, plain inline styles, no stylesheet of either zone.
export default function NotFound() {
  return (
    <html lang="en">
      <head>
        <title>Page not found · XPAND</title>
      </head>
      <body style={{ fontFamily: "system-ui, sans-serif", margin: "4rem auto", maxWidth: "36rem", padding: "0 1rem", lineHeight: 1.5 }}>
        <main>
          <h1>Page not found</h1>
          <p>
            There is no page at this address. / No hay ninguna página en esta dirección.
          </p>
          <p>
            <Link href="/">Home</Link> · <Link href="/casos">Explorar casos</Link>
          </p>
        </main>
      </body>
    </html>
  );
}
