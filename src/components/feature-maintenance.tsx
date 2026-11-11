import Link from "next/link";
import { ArrowLeft, Wrench } from "lucide-react";

export function FeatureMaintenance() {
  return (
    <main className="min-h-screen bg-[#0B0C0F] px-6 text-[#EDEFF5] flex items-center justify-center">
      <section className="w-full max-w-lg rounded-3xl border border-[#23252C] bg-[#131418] p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl border border-[#6E79F4]/20 bg-[#6E79F4]/10 text-[#6E79F4]">
          <Wrench aria-hidden="true" size={26} />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#6E79F4]">Under maintenance</p>
        <h1 className="mt-3 text-2xl font-black">Coding Challenges are temporarily unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-[#C2C6D1]">
          We are improving this feature and will make it available again after testing is complete.
        </p>
        <Link href="/student" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#6E79F4] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#5D67E8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6E79F4]">
          <ArrowLeft aria-hidden="true" size={16} /> Back to dashboard
        </Link>
      </section>
    </main>
  );
}
