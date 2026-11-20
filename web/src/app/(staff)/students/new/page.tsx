import { PageHeader } from "@/components/ui";
import { getRepo } from "@/lib/server";
import { AdmissionForm } from "./admission-form";

export const metadata = { title: "New admission" };

export default async function NewStudentPage() {
  const repo = await getRepo();
  const [courses, batches, vendors] = await Promise.all([repo.courses(), repo.batches(), repo.vendors()]);
  return (
    <>
      <PageHeader title="New admission" subtitle="Creates the student, fee split, installments and all access channels in one step." />
      <AdmissionForm courses={courses} batches={batches} vendors={vendors} />
    </>
  );
}
