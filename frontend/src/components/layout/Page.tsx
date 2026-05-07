export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="mb-7"><h1 className="text-3xl font-extrabold tracking-tight text-slate-950 md:text-4xl">{title}</h1><p className="mt-2 max-w-3xl text-slate-500">{subtitle}</p></div>;
}
