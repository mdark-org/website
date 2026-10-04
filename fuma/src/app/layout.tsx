import type { ReactNode } from "react";

import "./global.css";
import { Inter } from 'next/font/google'
import {Provider} from "@/components/provider";
import {GoogleAnalytics} from "@/components/google-analytics.tsx";
const inter = Inter({
  subsets: ["latin"]
})


export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
    <body className="flex flex-col min-h-screen">
    <Provider>
      {children}
    </Provider>
    <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GAID as string} />
    </body>
    </html>
  );
}
