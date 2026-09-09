"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SoftCard } from "@/components/ui/surface";

type TemplateOption = {
  slug: string;
  nameAr: string;
  descriptionAr: string;
  category: string;
};

export function CreateSiteForm({ templates }: { templates: TemplateOption[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [templateSlug, setTemplateSlug] = useState(templates[0]?.slug || "blank");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, templateSlug }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "تعذر الإنشاء");
      return;
    }
    router.push(`/editor/${data.site.id}`);
    router.refresh();
  }

  return (
    <SoftCard className="p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold tracking-tight">إنشاء موقع جديد</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">اختر قالباً ثم خصّصه بالكامل في المحرر</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="site-name">اسم الموقع</Label>
          <Input
            id="site-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: معرض أعمالي"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>القالب</Label>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((tpl) => (
              <button
                key={tpl.slug}
                type="button"
                onClick={() => setTemplateSlug(tpl.slug)}
                className={`rounded-[var(--radius-xl)] border p-3.5 text-start transition ${
                  templateSlug === tpl.slug
                    ? "border-teal-700/40 bg-teal-50 ring-2 ring-teal-700/15 dark:bg-teal-950/40"
                    : "border-stone-200/80 bg-[var(--card)]/70 hover:border-stone-300 dark:border-stone-700"
                }`}
              >
                <div className="truncate font-medium">{tpl.nameAr}</div>
                <div className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted)]">{tpl.descriptionAr}</div>
              </button>
            ))}
          </div>
        </div>
        {error ? <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
        <Button type="submit" disabled={loading || !name.trim()} className="rounded-full">
          {loading ? "جاري الإنشاء..." : "إنشاء وفتح المحرر"}
        </Button>
      </form>
    </SoftCard>
  );
}
