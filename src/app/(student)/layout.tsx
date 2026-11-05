import { requireStudent } from "@/lib/data";
import { DesktopNav, MobileNav } from "@/components/nav/student-nav";
import { FooterNote } from "@/components/nav/footer-note";
import { AssistantWidget } from "@/components/assistant/assistant-widget";
import { isAssistantConfigured } from "@/lib/assistant/config";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireStudent();
  const name = viewer.profile.full_name ?? viewer.profile.email;
  return (
    <div className="flex min-h-dvh flex-col">
      <DesktopNav name={name} isAdmin={viewer.isAdmin} />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 sm:px-6 md:pb-14 md:pt-8">
        {children}
      </main>
      <FooterNote className="hidden px-6 pb-8 md:block" />
      <MobileNav />
      {/* Shown when an OpenRouter key is set; in development it also explains how to set one up. */}
      {(isAssistantConfigured() || process.env.NODE_ENV === "development") && <AssistantWidget configured={isAssistantConfigured()} />}
    </div>
  );
}
