import { queryOptions } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { supabase } from "@/integrations/supabase/client";

export type Thread = {
  id: string;
  title: string;
  pinned: boolean;
  archived: boolean;
  updated_at: string;
};

export const threadsQuery = queryOptions({
  queryKey: ["threads"],
  queryFn: async (): Promise<Thread[]> => {
    const { data, error } = await supabase
      .from("threads")
      .select("id,title,pinned,archived,updated_at")
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const messagesQuery = (threadId: string) =>
  queryOptions({
    queryKey: ["messages", threadId],
    queryFn: async (): Promise<UIMessage[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select("sdk_id,role,parts")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data.map((r) => ({
        id: r.sdk_id,
        role: r.role as UIMessage["role"],
        parts: r.parts as unknown as UIMessage["parts"],
      }));
    },
    staleTime: Infinity,
  });

export async function createThread(): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("not signed in");
  const { data, error } = await supabase
    .from("threads")
    .insert({ user_id: u.user.id })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
