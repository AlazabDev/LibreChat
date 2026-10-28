import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { createThread, threadsQuery } from "@/lib/threads";
import { Shimmer } from "@/components/ai-elements/shimmer";

export const Route = createFileRoute("/_authenticated/chat/")({
  head: () => ({ meta: [
    { title: "مساحة العمل — AzCodex" },
    { name: "description", content: "افتح محادثاتك المحفوظة أو ابدأ محادثة جديدة مع AzCodex." },
    { property: "og:title", content: "مساحة العمل — AzCodex" },
    { property: "og:description", content: "المحادثات المحفوظة ومساحة عمل الوكيل الذكي." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: ChatIndex,
});

function ChatIndex() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const threads = await qc.fetchQuery(threadsQuery);
      const existing = threads.find((t) => !t.archived);
      const id = existing?.id ?? (await createThread());
      if (!existing) qc.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: id }, replace: true });
    })();
  }, [qc, navigate]);

  return (
    <div className="grid flex-1 place-items-center text-muted-foreground">
      <Shimmer>جاري تجهيز مساحة العمل...</Shimmer>
    </div>
  );
}
