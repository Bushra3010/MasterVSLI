import { ProfileForm } from "@/components/profile-form";
import { PageHeader } from "@/components/ui";
import { createProfileRepo } from "@/lib/profile";
import { getStudentReadRepo } from "@/lib/server";
import { getServiceStore, requireStudent } from "@/lib/session";
import { saveOwnProfileAction } from "../actions";

export const metadata = { title: "My profile" };

export default async function MyProfile() {
  const s = await requireStudent();
  const [p, options] = await Promise.all([(await getStudentReadRepo()).profile(s.studentId), createProfileRepo(getServiceStore()).options()]);
  if (!p) return <p>Profile not found.</p>;
  return (
    <>
      <PageHeader title="My profile" subtitle="Keep your details up to date. Course, fees and access are managed by the institute office." />
      <ProfileForm mode="student" action={saveOwnProfileAction} student={p.student} education={p.education} refs={{}} options={options} cancelHref="/portal" />
    </>
  );
}
