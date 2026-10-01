import Script from 'next/script'

/**
 * Google Analytics (gtag.js). Replaces `GoogleAnalytics` from `@next/third-parties/google`: that
 * package is CommonJS (getter exports, `require("next/script")`), and under vinext/workerd its named
 * export resolves to `undefined`, which crashed the root layout.
 */
export function GoogleAnalytics({ gaId }: { gaId?: string }) {
  if (!gaId) return null
  return (
    <>
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${JSON.stringify(gaId)});`}
      </Script>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`} strategy="afterInteractive" />
    </>
  )
}
