import Image from "next/image";
import Link from "next/link";
import { ReactNode } from "react";

type AppPageProps = {
  title: string;
  description: string;
  children: ReactNode;
  actions?: ReactNode;
  maxWidthClass?: string;
};

export function AppPage({
  title,
  description,
  children,
  actions,
  maxWidthClass = "max-w-7xl",
}: AppPageProps) {
  return (
    <main className={`mx-auto w-full ${maxWidthClass} px-4 py-6 font-sans text-slate-950 sm:px-6 lg:px-8`}>
      <div className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-6 border-b border-slate-200 bg-slate-950 px-5 py-5 text-white sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Image
              src="/mgs-logo.svg"
              alt="Malta Gym Solutions"
              width={118}
              height={63}
              priority
              className="block h-auto w-[108px] rounded bg-white px-2 py-1"
            />
            <div>
              <Link href="/" className="mb-1 inline-block text-xs font-bold uppercase tracking-[0.08em] !text-slate-300 no-underline hover:!text-white">
                Dashboard
              </Link>
              <h1 className="m-0 text-2xl font-bold tracking-normal !text-white sm:text-3xl">{title}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{description}</p>
            </div>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div> : null}
        </div>
      </div>
      {children}
    </main>
  );
}
