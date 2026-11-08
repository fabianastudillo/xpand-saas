import Link from "next/link";

import { landingPageContent } from "@/config/landing-page-config";
import { Typography } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Footer } from "./_components/footer";

// The home page: what XPAND is and the two ways in (ruling R20). Prices only appear once payments are on, in
// /pricing; this page never shows them.
export default function Home() {
  const { headline, subheadline, today, explore, signIn } =
    landingPageContent.hero;

  return (
    <>
      <section id="hero" lang="es" className="py-16 max-w-2xl">
        <Typography component="h1" className="mb-4">
          {headline}
        </Typography>
        <Typography className="text-xl mb-2">{subheadline}</Typography>
        <Typography className="mb-8">{today}</Typography>
        <div className="flex flex-wrap gap-4">
          <Button asChild>
            <Link href={explore.url}>{explore.title}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={signIn.url}>{signIn.title}</Link>
          </Button>
        </div>
      </section>
      <Footer />
    </>
  );
}
