import Image from "next/image";
import { getServiceRepo } from "@/lib/server";

export const metadata = { title: "Apply for admission" };

/** Public admission enquiry form. The website can link here or post to /api/public/admission. */
export default async function ApplyPage({ searchParams }: PageProps<"/apply">) {
  const sp = await searchParams;
  const courses = await getServiceRepo().courses().catch(() => []);
  return (
    <main className="grid min-h-screen place-items-center bg-canvas p-4">
      <div className="w-full max-w-md rounded-[5px] border border-line bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <Image src="/logo-official.png" alt="MasterVLSI — Leader In Semiconductor Industry" width={220} height={52} unoptimized priority className="h-12 w-auto" />
        </div>
        {sp.sent ? (
          <div className="rounded-[5px] bg-emerald-50 p-4 text-sm text-emerald-800">
            Thank you! Your enquiry has reached our admissions team. We will call or email you shortly.
          </div>
        ) : (
          <form action="/api/public/admission" method="post" className="space-y-3">
            <h1 className="text-base font-medium text-navy">Apply for admission</h1>
            <label className="block text-xs text-muted">Full name *<input name="full_name" required minLength={2} className="input mt-1" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-muted">Mobile<input name="phone" type="tel" className="input mt-1" /></label>
              <label className="block text-xs text-muted">Email<input name="email" type="email" className="input mt-1" /></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-muted">Course
                <select name="course_code" className="input mt-1" defaultValue="">
                  <option value="">Not sure yet</option>
                  {courses.map((c) => <option key={c.id} value={c.code}>{c.name}</option>)}
                </select>
              </label>
              <label className="block text-xs text-muted">City<input name="city" className="input mt-1" /></label>
            </div>
            <label className="block text-xs text-muted">Message<textarea name="message" rows={3} className="input mt-1" /></label>
            <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
            <button className="btn-primary w-full">Submit enquiry</button>
            <p className="text-[11px] text-muted">Give a mobile number or email so we can reach you.</p>
          </form>
        )}
      </div>
    </main>
  );
}
