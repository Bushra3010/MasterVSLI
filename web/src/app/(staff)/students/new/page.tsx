import { PageHeader } from "@/components/ui";
import { getRepo } from "@/lib/server";
import { AdmissionForm, type AdmissionDefaults } from "./admission-form";

export const metadata = { title: "New admission" };

export default async function NewStudentPage({ searchParams }: PageProps<"/students/new">) {
  const sp = await searchParams;
  const repo = await getRepo();
  const [courses, batches, vendors, enquiries] = await Promise.all([repo.courses(), repo.batches(), repo.vendors(), repo.enquiries()]);
  const e = typeof sp.enquiry === "string" ? enquiries.find((x) => x.id === sp.enquiry) : undefined;
  const defaults: AdmissionDefaults = e
    ? { enquiry_id: e.id, full_name: e.full_name, email: e.email ?? undefined, phone: e.phone ?? undefined, city: e.city ?? undefined, course_code: e.course_code ?? undefined }
    : {};
  return (
    <>
      <PageHeader title="New admission" subtitle="Creates the student, fee split, installments and all access channels in one step." />
      <AdmissionForm courses={courses} batches={batches} vendors={vendors} defaults={defaults} />
    </>
  );
}
