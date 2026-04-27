export function Logo({ size = 28 }: { size?: number }) {
  // Stylised "S" mark — abstract reference to Sourceful's energy / signal motif.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="1" y="1" width="30" height="30" rx="8" fill="#00FF84" />
      <path
        d="M22 11c-1.5-2-4-3-7-3-3.5 0-6 2-6 4.5 0 2.2 1.6 3.5 5 4.2l2.2.5c2.4.5 3.6 1 3.6 2.3 0 1.4-1.6 2.3-4 2.3-2.4 0-4.3-1-5.3-2.5"
        stroke="#0A0A0A"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
