export function BrandMark() {
  return (
    <svg
      aria-hidden="true"
      className="brand-mark"
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M7.3 6.25h9.05l4.35 4.38v10.02a1.7 1.7 0 0 1-1.7 1.7H7.3a1.7 1.7 0 0 1-1.7-1.7v-12.7a1.7 1.7 0 0 1 1.7-1.7Z" />
      <path d="M16.35 6.4v4.22h4.17" />
      <path d="M10.2 15.88h7.6M12.17 12.55l-1.97 3.33 1.97 3.33" />
      <path d="m15.84 12.55 1.96 3.33-1.96 3.33" />
    </svg>
  )
}

export function Brand() {
  return (
    <div className="brand">
      <BrandMark />
      <span>PDF Compressor</span>
    </div>
  )
}
