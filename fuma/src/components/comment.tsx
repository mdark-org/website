"use client"
import { Suspense } from 'react'
import { Comments as CommentsInternal, CommentsProps } from '@fuma-comment/react'
import { createUploadThingStorage } from "@fuma-comment/react/uploadthing";
import { authClient } from '@/lib/auth-client'
import { usePathname } from 'fumadocs-core/framework';

const signIn = (callbackPath: string) => {
  void authClient.signIn.social({
    provider: 'google',
    callbackURL: `${callbackPath}`,
  });
};
const comment = createUploadThingStorage();
// fuma-comment's editor lazily renders its toolbar buttons without a local
// Suspense boundary. Without this boundary, the suspension bubbles up to the
// router's route-level Suspense (which has a null fallback) and the whole page
// is hidden until the chunks load - a full-page white flash on first visit.
// Keep the fallback height close to the comments block to avoid layout shifts.
const fallback = <div className="h-64" aria-hidden />;

type CommentProps = Omit<CommentsProps, 'storage' | 'auth'>

export function Comments({...props}: CommentProps) {
  const path = usePathname()
  return (
    <Suspense fallback={fallback}>
      <CommentsInternal
        storage={comment}
        mention={{
          enabled: true,
        }}
        auth={{
          type: "api",
          signIn: () => signIn(path),
        }}
        {...props}
    />
    </Suspense>
);
}
