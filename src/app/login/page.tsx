"use client";

import { LoginScreen } from "@/components/auth/LoginScreen";
import './login.css';

/**
 * The public sign-in page.
 *
 * All of it is `LoginScreen`, which the coach's preview at `/cms-preview/login`
 * renders too — one component, so the preview cannot drift from the thing it is
 * previewing.
 *
 * Note what is *not* passed: `isPreview`. This page used to be the preview as
 * well, opened as `/login?preview=true`, and carried the machinery for it — a
 * reader for the draft in local storage and a `postMessage` listener. Both had
 * already caused real defects on this exact page, which is the worst page in the
 * product to be carrying anything it does not need. They now live behind an
 * admin-guarded route and are unreachable from here.
 */
export default function LoginPage() {
  return <LoginScreen />;
}
