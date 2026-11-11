import { redirect } from "next/navigation";
import { BookOpen, ExternalLink, Library } from "lucide-react";
import SignOutButton from "@/components/sign-out-button";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { getCurrentUser } from "@/services/auth";
import { listPublicCourses } from "@/services/public-learning";

export const dynamic = "force-dynamic";

const safeUrl = (value: string | null) => {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch { return null; }
};

export default async function PublicPage() {
  const current = await getCurrentUser();
  if (!current?.user || !current.availableRoles?.includes("public")) redirect("/login");
  const courses = await listPublicCourses(current.user.id);

  return <div className="min-h-screen bg-[#0B0C0F] text-[#EDEFF5]">
    <header className="border-b border-[#23252C] bg-[#131418]">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-3"><Library className="text-[#6E79F4]" size={20}/><div><p className="text-sm font-bold">Hynox Campus</p><p className="text-[10px] text-[#9BA1AE]">Public Learning Library</p></div></div>
        <SignOutButton/>
      </div>
    </header>
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <section><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6E79F4]">My courses</p><h1 className="mt-2 text-3xl font-semibold">Welcome, {current.user.full_name || "Learner"}</h1><p className="mt-2 text-sm text-[#A3A9B6]">Read the lessons and resources included with your purchases.</p></section>
      {!courses.length ? <section className="rounded-2xl border border-[#2B2E37] bg-[#131418] p-10 text-center"><BookOpen className="mx-auto text-[#6E79F4]"/><h2 className="mt-4 font-semibold">No active course access</h2><p className="mt-2 text-sm text-[#9BA1AE]">A completed purchase will appear here after access is provisioned.</p></section> :
        <div className="space-y-8">{courses.map(course => <article key={course.id} className="overflow-hidden rounded-2xl border border-[#2B2E37] bg-[#131418]">
          <div className="border-b border-[#2B2E37] p-6"><h2 className="text-xl font-semibold">{course.title}</h2>{course.description && <p className="mt-2 text-sm text-[#A3A9B6]">{course.description}</p>}</div>
          <div className="space-y-4 p-6">{course.modules.length ? course.modules.map((module, index) => <details key={module.id} className="rounded-xl border border-[#303441] bg-[#0F1014]" open={index === 0}>
            <summary className="cursor-pointer px-5 py-4 font-semibold">{module.title}</summary>
            <div className="space-y-4 border-t border-[#303441] p-5">{module.description && <p className="text-sm text-[#A3A9B6]">{module.description}</p>}{module.lessons.map(lesson => <section key={lesson.id} className="rounded-xl border border-[#23252C] bg-[#15171D] p-5">
              <h3 className="font-semibold">{lesson.title}</h3>
              {lesson.content && <div className="mt-4"><MarkdownRenderer content={lesson.content}/></div>}
              {safeUrl(lesson.video_url) && <a className="mt-4 inline-flex items-center gap-2 text-sm text-[#8D96FF]" href={safeUrl(lesson.video_url)!} target="_blank" rel="noopener noreferrer">Open lesson video <ExternalLink size={14}/></a>}
              {!!lesson.resources.length && <ul className="mt-4 space-y-2">{lesson.resources.map(resource => { const url = safeUrl(resource.resource_url); return <li key={resource.id} className="rounded-lg border border-[#2B2E37] p-3"><p className="text-sm font-medium">{resource.title}</p>{resource.description && <p className="mt-1 text-xs text-[#9BA1AE]">{resource.description}</p>}{url && <a className="mt-2 inline-flex items-center gap-1 text-xs text-[#8D96FF]" href={url} target="_blank" rel="noopener noreferrer">Open resource <ExternalLink size={12}/></a>}</li>; })}</ul>}
            </section>)}</div>
          </details>) : <p className="text-sm text-[#9BA1AE]">Course content is being prepared.</p>}</div>
        </article>)}</div>}
    </main>
  </div>;
}
