import Image from "next/image";

export const metadata = { title: "College registration" };

/** Public page colleges use to connect with MasterVLSI. Entries wait for staff verification. */
export default async function CollegeRegisterPage({ searchParams }: PageProps<"/college-register">) {
  const sp = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-canvas p-4">
      <div className="w-full max-w-lg rounded-[5px] border border-line bg-white p-6 shadow-sm">
        <div className="mb-5"><Image src="/logo-official.png" alt="MasterVLSI — Leader In Semiconductor Industry" width={220} height={52} unoptimized priority className="h-12 w-auto" /></div>
        {sp.sent ? (
          <div className="rounded-[5px] bg-emerald-50 p-4 text-sm text-emerald-800">Thank you! Our college relations team will contact you shortly.</div>
        ) : (
          <form action="/api/public/college" method="post" className="space-y-3">
            <h1 className="text-base font-medium text-navy">Partner with MasterVLSI — college registration</h1>
            {typeof sp.error === "string" && <div role="alert" className="rounded-[5px] bg-red-50 p-2 text-sm text-red-800">{sp.error}</div>}
            <label className="block text-xs text-muted">College name *<input name="college_name" required minLength={3} className="input mt-1" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-muted">City<input name="city" className="input mt-1" /></label>
              <label className="block text-xs text-muted">State<input name="state" className="input mt-1" /></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-muted">Your name *<input name="contact_name" required minLength={2} className="input mt-1" /></label>
              <label className="block text-xs text-muted">Designation<select name="designation" className="input mt-1"><option>TPO</option><option>HOD</option><option>Principal</option><option>Faculty</option><option>Other</option></select></label>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <label className="block text-xs text-muted">Department<input name="department" placeholder="ECE" className="input mt-1" /></label>
              <label className="block text-xs text-muted">Mobile<input name="phone" type="tel" className="input mt-1" /></label>
              <label className="block text-xs text-muted">Email<input name="email" type="email" className="input mt-1" /></label>
            </div>
            <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
            <button className="btn-primary w-full">Submit</button>
          </form>
        )}
      </div>
    </main>
  );
}
