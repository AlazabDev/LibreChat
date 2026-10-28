// src/routes/_authenticated/chat.$threadId.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type FileUIPart,
  type UIMessage,
} from "ai";
import { Tool } from "@/components/ai-elements/tool";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { messagesQuery } from "@/lib/threads";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { ChartedResponse } from "@/components/ai-elements/agent-chart";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuTrigger,
  PromptInputActionMenuContent,
  usePromptInputAttachments,
  PromptInputBody,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import {
  Attachment,
  AttachmentRemove,
  useAttachmentContext,
  AttachmentInfo,
  AttachmentPreview,
  Attachments,
} from "@/components/ai-elements/attachments";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { AzLogo } from "@/components/AzLogo";
import { AgentSwitcher } from "@/components/AgentSwitcher";
import { parseAgents } from "@/lib/agents";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "محادثة الوكيل — AzCodex" },
      { name: "description", content: "تحدث مع وكيل AzCodex واعرض الردود والرسوم البيانية والمرفقات." },
      { property: "og:title", content: "محادثة الوكيل — AzCodex" },
      { property: "og:description", content: "مساحة محادثتك مع وكيل AzCodex الذكي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  const { data, isLoading, error } = useQuery(messagesQuery(threadId));

  if (error) return <p className="m-auto text-destructive animate-pulse">تعذر تحميل المحادثة</p>;
  if (isLoading || !data)
    return (
      <div className="m-auto text-muted-foreground animate-pulse">
        <Shimmer>جاري التحميل...</Shimmer>
      </div>
    );

  return <ChatWindow key={threadId} threadId={threadId} initial={data} />;
}

const SUGGESTIONS = [
  "اشرح لي بنية تطبيق Frappe مخصص",
  "كيف أنفذ bench migrate بأمان في الإنتاج؟",
  "راجع هذا الكود وحدد المشاكل",
  "اكتب DocType لإدارة طلبات الصيانة",
];

const SLASH_COMMANDS = [
  { cmd: "/repos", label: "اعرض مستودعات GitHub", prompt: "اعرض لي مستودعاتي على GitHub" },
  { cmd: "/commits", label: "آخر الالتزامات في مستودع", prompt: "اعرض آخر الالتزامات في المستودع " },
  { cmd: "/file", label: "اقرأ ملفاً من GitHub", prompt: "اقرأ الملف التالي من GitHub: " },
  { cmd: "/frappe", label: "سجلات Frappe / ERPNext", prompt: "اعرض آخر سجلات Project من Frappe" },
  { cmd: "/bench", label: "تنفيذ على البنش", prompt: "على البنش نفّذ: " },
  { cmd: "/search", label: "بحث في الويب", prompt: "ابحث في الويب عن: " },
  { cmd: "/summary", label: "لخّص المحادثة", prompt: "لخّص هذه المحادثة بالعربية واستخرج نقاط العمل" },
];

function ChatWindow({ threadId, initial }: { threadId: string; initial: UIMessage[] }) {
  const qc = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const { data: agents = parseAgents(undefined) } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => parseAgents((await supabase.auth.getUser()).data.user?.user_metadata["agents"]),
  });
  const [picked, setPicked] = useState<string | null>(null);
  const agentId = picked && agents.list.some((a) => a.id === picked) ? picked : agents.activeId;
  const changeAgent = (id: string) => {
    setPicked(id);
    const next = { ...agents, activeId: id };
    qc.setQueryData(["agents"], next);
    void supabase.auth.updateUser({ data: { agents: next } });
  };

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { threadId },
        headers: async (): Promise<Record<string, string>> => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    [threadId],
  );

  const { messages, sendMessage, status, stop, addToolApprovalResponse } = useChat({
    id: threadId,
    messages: initial,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onError: (e) => toast.error(e.message || "حدث خطأ أثناء الاتصال"),
    onFinish: ({ messages: all }) => {
      qc.setQueryData(messagesQuery(threadId).queryKey, all);
      qc.invalidateQueries({ queryKey: ["threads"] });
    },
  });
  const [draft, setDraft] = useState("");
  const slash = draft.startsWith("/") && !draft.includes(" ")
    ? SLASH_COMMANDS.filter((c) => c.cmd.startsWith(draft))
    : [];

  const busy = status === "submitted" || status === "streaming" || isUploading;

  useEffect(() => {
    if (status === "ready") {
      document.querySelector<HTMLTextAreaElement>("textarea[name='message']")?.focus();
    }
  }, [status]);

  const uploadFiles = async (files: FileUIPart[]): Promise<FileUIPart[]> => {
    if (!files.length) return [];

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) throw new Error("يجب تسجيل الدخول لرفع الملفات");

    const uploaded: FileUIPart[] = [];

    for (const file of files) {
      const res = await fetch(file.url);
      const blob = await res.blob();
      const safeName = (file.filename || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${userId}/${threadId}/${Date.now()}_${safeName}`;

      const { data: uploadData, error } = await supabase.storage
        .from("chat-attachments")
        .upload(path, blob, {
          contentType: file.mediaType || blob.type,
          upsert: false,
        });

      if (error) {
        toast.error(`تعذر رفع الملف: ${file.filename}`);
        continue;
      }

      const { data: signedData } = await supabase.storage
        .from("chat-attachments")
        .createSignedUrl(uploadData.path, 60 * 60 * 24);

      uploaded.push({
        type: "file",
        filename: file.filename ?? safeName,
        mediaType: file.mediaType,
        url: signedData?.signedUrl || file.url,
      });
    }

    return uploaded;
  };

  const handleSend = async (message: PromptInputMessage) => {
    const text = message.text.trim();
    const files = message.files || [];

    if ((!text && files.length === 0) || busy) return;

    try {
      let uploadedParts: FileUIPart[] = [];
      if (files.length > 0) {
        setIsUploading(true);
        toast.loading("جاري رفع المرفقات...", { id: "upload" });
        uploadedParts = await uploadFiles(files);
        toast.dismiss("upload");
      }

      setDraft("");
      sendMessage({
        text,
        files: uploadedParts,
      }, { body: { agentId } });
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء رفع المرفقات");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex h-full flex-col relative bg-gradient-to-br from-background via-background/95 to-background/80">
      {/* Subtle background glow effect */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent opacity-50"></div>
      
      <Conversation className="flex-1 relative z-10">
        <ConversationContent className="mx-auto w-full max-w-4xl px-4 py-8">
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<span className="text-brand-text animate-pulse"><AzLogo size={56} /></span>}
              title="كيف أساعدك اليوم؟"
              description="وكيل AzCodex جاهز للتطوير والتشغيل وFrappe/ERPNext والمرفقات."
            >
              <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-500">
                <span className="transition-transform hover:scale-110"><AzLogo size={64} /></span>
                <div className="text-center">
                  <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">كيف أساعدك اليوم؟</h2>
                  <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                    وكيل AzCodex جاهز للتطوير، مجهز بأدوات Frappe Bench، ومستعد للمساعدة في الشيفرات البرمجية.
                  </p>
                </div>
                <div className="mt-4 grid w-full max-w-2xl gap-3 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSend({ text: s, files: [] })}
                      className="group rounded-xl border border-border bg-card/40 backdrop-blur-sm px-4 py-3 text-right text-sm text-card-foreground shadow-sm transition-all duration-300 hover:border-primary/40 hover:bg-card/60 hover:shadow-md hover:-translate-y-0.5"
                    >
                      <span className="bg-gradient-to-l from-foreground to-foreground/70 bg-clip-text group-hover:text-transparent transition-all">
                        {s}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </ConversationEmptyState>
          ) : (
            <div className="space-y-6">
              {messages.map((m) => (
                <Message key={m.id} from={m.role} className="animate-in slide-in-from-bottom-2 fade-in duration-300">
                  <MessageContent className="leading-relaxed">
                    {m.parts.some((p) => p.type === "file") && (
                      <Attachments variant="list" className="mb-4">
                        {m.parts
                          .filter((p): p is FileUIPart => p.type === "file")
                          .map((f, idx) => (
                            <Attachment key={idx} data={{ ...f, id: `${m.id}-${idx}` }} className="rounded-lg border border-border bg-card/30 backdrop-blur-sm shadow-sm transition-transform hover:scale-[1.01]">
                              <AttachmentPreview />
                              <AttachmentInfo />
                              <AttachmentDownload />
                            </Attachment>
                          ))}
                      </Attachments>
                    )}

                    {m.parts.map((part, i) => {
                      if (part.type === "text")
                        return m.role === "user" ? (
                          <p key={i} className="whitespace-pre-wrap text-sm md:text-base">{part.text}</p>
                        ) : (
                          <ChartedResponse key={i} text={part.text} isStreaming={part.state === "streaming"} />
                        );
                      if (part.type === "reasoning" && part.text)
                        return (
                          <Reasoning key={i} isStreaming={part.state === "streaming"} defaultOpen={false}>
                            <ReasoningTrigger className="hover:bg-primary/5 transition-colors rounded-md" />
                            <ReasoningContent className="border-l-2 border-primary/30 pl-4 my-2">{part.text}</ReasoningContent>
                          </Reasoning>
                        );
                      if (part.type === "dynamic-tool" || part.type.startsWith("tool-")) {
                        const t = part as unknown as {
                          type: string; toolName?: string; state: string; input?: unknown;
                          output?: unknown; errorText?: string; approval?: { id: string };
                        };
                        return (
                          <Tool
                            key={i}
                            part={{
                              name: t.toolName ?? t.type.replace(/^tool-/, ""),
                              state: t.state, input: t.input, output: t.output,
                              ...(t.errorText ? { errorText: t.errorText } : {}),
                              ...(t.approval?.id ? { approvalId: t.approval.id } : {}),
                            }}
                            onApprove={(id, ok) => addToolApprovalResponse({ id, approved: ok })}
                          />
                        );
                      }
                      return null;
                    })}
                  </MessageContent>
                </Message>
              ))}
            </div>
          )}
          {(status === "submitted" || isUploading) && (
            <div className="text-sm text-muted-foreground mt-4 p-4 rounded-xl border border-border bg-card/20 backdrop-blur-sm animate-pulse flex items-center justify-center">
              <Shimmer className="font-medium tracking-wide">
                {isUploading ? "جاري معالجة ورفع الملفات..." : "AzCodex يفكر..."}
              </Shimmer>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton className="hover:scale-110 transition-transform shadow-lg" />
      </Conversation>

      <div className="mx-auto w-full max-w-4xl px-4 pb-6 pt-2 relative z-20">
        {slash.length > 0 && (
          <div role="listbox" className="absolute bottom-full mb-2 w-[calc(100%-2rem)] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg">
            {slash.map((c) => (
              <button
                key={c.cmd}
                type="button"
                onClick={() => {
                  setDraft(c.prompt);
                  document.querySelector<HTMLTextAreaElement>("textarea[name='message']")?.focus();
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-right text-sm hover:bg-accent"
              >
                <span dir="ltr" className="font-mono text-brand-text">{c.cmd}</span>
                <span className="text-muted-foreground">{c.label}</span>
              </button>
            ))}
          </div>
        )}
        <PromptInput
          maxFileSize={10 * 1024 * 1024}
          onSubmit={handleSend}
          className="rounded-2xl border border-border bg-background/70 backdrop-blur-xl shadow-xl transition-all duration-300 focus-within:shadow-brand-focus focus-within:border-primary/30 focus-within:bg-background/80"
        >
          <PromptInputHeader>
            <PromptInputAttachments />
          </PromptInputHeader>

          <PromptInputBody>
            <PromptInputTextarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="اكتب تعليماتك، أو / للأوامر السريعة، أو اسحب الملفات هنا..."
              className="resize-none min-h-[60px] text-base"
            />
          </PromptInputBody>

          <PromptInputFooter className="justify-between pt-2 border-t border-border">
            <div className="flex items-center gap-3">
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger aria-label="إرفاق ملف أو صورة" />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments label="إرفاق ملف أو صورة" />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
              <AgentSwitcher agents={agents.list} activeId={agentId} onChange={changeAgent} />
              <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-[10px] font-medium tracking-wider text-brand-text">
                AzCodex Agent
              </span>
            </div>
            <PromptInputSubmit 
              status={busy ? "submitted" : status} 
              onStop={stop} 
              className="rounded-full transition-transform hover:scale-105 active:scale-95"
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

function AttachmentDownload() {
  const { data } = useAttachmentContext();
  const url = "url" in data ? data.url : undefined;
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={"filename" in data ? data.filename : undefined}
      className="ms-auto text-xs font-semibold text-brand-text hover:text-brand-text/80 transition-colors hover:underline"
    >
      تنزيل
    </a>
  );
}

function PromptInputAttachments() {
  const attachments = usePromptInputAttachments();
  if (!attachments.files.length) return null;
  return (
    <Attachments variant="inline" className="p-2">
      {attachments.files.map((file) => (
        <Attachment key={file.id} data={file} onRemove={() => attachments.remove(file.id)} className="rounded-lg bg-background/50 backdrop-blur-md border border-border shadow-sm">
          <AttachmentPreview />
          <AttachmentInfo />
          <AttachmentRemove className="hover:bg-destructive/20 hover:text-destructive transition-colors" />
        </Attachment>
      ))}
    </Attachments>
  );
}
