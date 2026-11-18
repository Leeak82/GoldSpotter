export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect width="48" height="48" rx="12" fill="#1a150f" stroke="#e7c27a" strokeWidth="1.5" />
      <rect x="10" y="12" width="28" height="22" rx="3" fill="#100e0b" stroke="#8d6a32" strokeWidth="1" />
      <rect x="13" y="16" width="8" height="3" rx="0.6" fill="#f0c14b" />
      <rect x="23" y="16" width="11" height="3" rx="0.6" fill="#e3943a" />
      <rect x="13" y="22" width="12" height="8" rx="1.4" fill="none" stroke="#cbb892" strokeWidth="1.2" />
      <path d="M12 38h24" stroke="#e7c27a" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
