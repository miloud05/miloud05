export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect width="40" height="40" rx="10" fill="#e8590c" />
      <path d="M9 29h22" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M12 29V17l8-6 8 6v12" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M17 29v-6h6v6" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M26 9h7M33 9v5" stroke="#ffd8bf" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      <div className="leading-none">
        <p className={`text-lg font-extrabold tracking-tight ${light ? "text-white" : "text-text"}`}>
          Genie<span className="text-primary">TRVX</span>
        </p>
        <p className={`mt-0.5 text-[10px] font-medium tracking-wider uppercase ${light ? "text-white/60" : "text-muted"}`}>
          BTP · ERP
        </p>
      </div>
    </div>
  );
}
