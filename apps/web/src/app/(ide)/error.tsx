"use client";

import { RouteError } from "@/ide/app/RouteError";

export default function Error({ error }: { error: Error & { digest?: string } }) {
  return <RouteError error={error} />;
}
