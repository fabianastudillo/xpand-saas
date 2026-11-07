"use client";

import dynamic from "next/dynamic";

import { appAnalyticsConfig } from "@/config/app-analytics-config";

const isProd = process.env.NODE_ENV === "production";

const GoogleAnalytics = dynamic(() => import("./google-analytics"), { ssr: false });

// Google Analytics loads only in production and only with an id configured: otherwise nothing is requested.
export const Analytics = () => {
  if (!isProd || !appAnalyticsConfig.googleAnalyticsId) {
    return null;
  }

  return <GoogleAnalytics />;
};
