import { Card, PageHeader } from "@/components/ui";
import { requireStudent } from "@/lib/session";
import { PasswordForm } from "./password-form";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const s = await requireStudent();
  return (
    <>
      <PageHeader title="Account" subtitle={s.email ?? s.name} />
      <Card title="Change password" className="max-w-md">
        <PasswordForm />
      </Card>
    </>
  );
}
