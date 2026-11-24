import Link from "next/link";
import { notFound } from "next/navigation";
import { ProfileForm } from "@/components/profile-form";
import { PROFILE_SECTIONS } from "@/lib/types-profile";
import { PageHeader } from "@/components/ui";
import { createProfileRepo } from "@/lib/profile";
import { getRepo } from "@/lib/server";
import { getSession, getStore } from "@/lib/session";
import type { Branch, Client, College } from "@/lib/types";
import { saveProfileAction } from "../../profile-actions";

export const metadata = { title: "Edit student" };

export default async function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = await getRepo();
  const prof = createProfileRepo(await getStore());
  const [p, courses, batches, branches, colleges, clients, options, me] = await Promise.all([
    repo.profile(id), repo.courses(), repo.batches(), repo.list<Branch>("branches"), repo.list<College>("colleges"), repo.list<Client>("clients"), prof.options(), getSession(),
  ]);
  if (!p) notFound();
  const s = p.student;
  const contacts = s.category === "college" && s.college_id ? await prof.collegeContacts(s.college_id) : [];
  const ref = (c: string) => p.access.find((a) => a.channel === c)?.external_ref ?? null;
  const sections = PROFILE_SECTIONS.filter(([k]) => k !== "college" || s.category === "college");

  return (
    <>
      <PageHeader
        title={`Edit profile — ${s.full_name}`}
        subtitle={`${s.enrollment_no} · fees and installments are managed under Fees`}
        actions={<Link href={`/students/${id}`} className="btn-ghost">Back to profile</Link>}
      />
      <div className="grid gap-5 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <nav aria-label="Profile sections" className="hidden lg:block">
          <ul className="sticky top-20 space-y-0.5 rounded-[5px] border border-line bg-white p-2 text-sm shadow-sm">
            {sections.map(([k, l]) => <li key={k}><a href={`#${k}`} className="block rounded px-2 py-1.5 text-slate-600 hover:bg-slate-50 hover:text-brand">{l}</a></li>)}
          </ul>
        </nav>
        <ProfileForm
          mode="staff"
          action={saveProfileAction.bind(null, id)}
          student={s}
          education={p.education}
          refs={{ zoom: ref("zoom"), teamviewer: ref("teamviewer"), biometric: ref("biometric") }}
          options={options}
          canRemove={me?.role === "super_admin" || me?.role === "admin"}
          courses={courses}
          batches={batches}
          branches={branches}
          colleges={colleges}
          clients={clients}
          contacts={contacts}
          cancelHref={`/students/${id}`}
        />
      </div>
    </>
  );
}
