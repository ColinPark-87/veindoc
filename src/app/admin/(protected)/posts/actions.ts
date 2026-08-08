"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { getMe, isStaff, logActivity } from "@/lib/auth";

export async function createPost(form: FormData) {
  const me = await getMe();
  if (!isStaff(me)) throw new Error("권한 없음");
  const title = String(form.get("title") ?? "").trim();
  if (!title) return;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .insert({
      category: String(form.get("category") ?? "notice"),
      title,
      body: String(form.get("body") ?? ""),
      is_published: form.get("publish") === "on",
      author: me!.id,
    })
    .select("id")
    .single();

  if (!error) await logActivity("post.create", "posts", data?.id, { title });
  revalidatePath("/admin/posts");
}

export async function togglePost(form: FormData) {
  const me = await getMe();
  if (!isStaff(me)) throw new Error("권한 없음");
  const id = String(form.get("id"));
  const next = form.get("next") === "1";

  const supabase = await createClient();
  const { error } = await supabase
    .from("posts")
    .update({ is_published: next, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (!error) await logActivity(next ? "post.publish" : "post.unpublish", "posts", id);
  revalidatePath("/admin/posts");
}

export async function deletePost(form: FormData) {
  const me = await getMe();
  if (!isStaff(me)) throw new Error("권한 없음");
  const id = String(form.get("id"));
  const supabase = await createClient();
  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (!error) await logActivity("post.delete", "posts", id);
  revalidatePath("/admin/posts");
}
