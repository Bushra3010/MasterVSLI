import Image from "next/image";
import { signOut } from "../auth-actions";

export const metadata = { title: "No access" };

export default function NoAccess() {
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 text-center shadow-lg">
        <Image src="/logo.png" alt="MasterVLSI" width={64} height={64} className="mx-auto" />
        <h1 className="mt-2 text-lg font-semibold text-navy">Your account isn&apos;t set up yet</h1>
        <p className="mt-2 text-sm text-muted">
          You&apos;re signed in, but this login isn&apos;t linked to a student record or a staff role. Please ask the institute office to
          link your account.
        </p>
        <form action={signOut} className="mt-5">
          <button className="btn-ghost">Sign out</button>
        </form>
      </div>
    </main>
  );
}
