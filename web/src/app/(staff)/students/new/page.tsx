import { PageHeader } from "@/components/ui";
import { getRepo } from "@/lib/server";
import { getSession, isSuperAdmin } from "@/lib/session";
import type { Branch, Client, College, Lead } from "@/lib/types";
import { AdmissionForm, type AdmissionDefaults } from "./admission-form";

export const metadata = { title: "New admission" };

export default async function NewStudentPage({ searchParams }: PageProps<"/students/new">) {
  const sp = await searchParams;
  const repo = await getRepo();
  const [courses, batches, vendors, enquiries] = await Promise.all([repo.courses(), repo.batches(), repo.vendors(), repo.enquiries()]);
  const e = typeof sp.enquiry === "string" ? enquiries.find((x) => x.id === sp.enquiry) : undefined;
  const lead = typeof sp.lead === "string" ? await repo.one<Lead>("leads", sp.lead) : null;
  const [branches, colleges, clients] = await Promise.all([repo.list<Branch>("branches"), repo.list<College>("colleges"), repo.list<Client>("clients")]);
  const defaults: AdmissionDefaults = lead
    ? { lead_id: lead.id, full_name: lead.full_name, email: lead.email ?? undefined, phone: lead.phone ?? undefined, city: lead.city ?? undefined, course_code: lead.course_code ?? undefined, source: lead.source }
    : e
      ? { enquiry_id: e.id, full_name: e.full_name, email: e.email ?? undefined, phone: e.phone ?? undefined, city: e.city ?? undefined, course_code: e.course_code ?? undefined, source: "Website" }
      : {};
  return (
    <>
      <PageHeader title="New admission" subtitle="Creates the student, fee split, installments and all access channels in one step." />
      <AdmissionForm courses={courses} batches={batches} vendors={vendors} defaults={defaults} branches={branches} colleges={colleges} clients={clients} kacha={isSuperAdmin(await getSession())} />
    </>
  );
}
