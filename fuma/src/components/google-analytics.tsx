import { useEffect } from "react";

export function GoogleAnalytics({ gaId }: { gaId?: string }) {
  useEffect(() => {
    if (!gaId) return;

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
    document.head.appendChild(script);

    const init = document.createElement("script");
    init.textContent = `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${JSON.stringify(gaId)});`;
    document.head.appendChild(init);

    return () => {
      script.remove();
      init.remove();
    };
  }, [gaId]);

  return null;
}
