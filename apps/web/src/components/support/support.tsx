"use client";

import dynamic from "next/dynamic";

import { supportConfig } from "@/config/support-config";

const isProd = process.env.NODE_ENV === "production";

const Crisp = dynamic(() => import("./crisp"), { ssr: false });

// Crisp loads only in production and only with an id configured: otherwise nothing is rendered or requested.
export const Support = () => {
  if (!isProd || !supportConfig.crispId) {
    return null;
  }

  return <Crisp />;
};
