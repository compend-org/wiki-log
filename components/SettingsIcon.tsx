export default function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeMiterlimit="10"
      aria-hidden="true"
      className={className}
    >
      <g transform="translate(2 3)">
        <circle cx="2.5" cy="2.5" r="2.5" transform="translate(7.5 6.5)" />
        <path
          transform="translate(0.864 0.051)"
          d="M4.452,16.794l.087-3.249-3.249.087A9.078,9.078,0,0,1,.276,11.185l2.36-2.236L.276,6.712A9.078,9.078,0,0,1,1.29,4.265l3.249.087L4.452,1.1A9.078,9.078,0,0,1,6.9.089l2.236,2.36L11.372.089A9.078,9.078,0,0,1,13.82,1.1l-.087,3.249,3.249-.087A9.081,9.081,0,0,1,18,6.712l-2.36,2.237L18,11.185a9.081,9.081,0,0,1-1.015,2.447l-3.249-.087.087,3.249a9.078,9.078,0,0,1-2.448,1.015l-2.236-2.36L6.9,17.809A9.078,9.078,0,0,1,4.452,16.794Z"
        />
      </g>
    </svg>
  );
}