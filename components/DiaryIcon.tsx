export default function DiaryIcon({ className }: { className?: string }) {
    return (
        <svg 
        xmlns="http://w3.org" 
        viewBox="0 0 24 24" 
        width="24" 
        height="24" 
        fill="none" 
        stroke="currentColor" 
        className={className}
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        >
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-0.5-5"></path>
            <path d="M6 2v20"></path>
            <line x1="10" y1="7" x2="16" y2="7"></line>
            <line x1="10" y1="11" x2="16" y2="11"></line>
            <line x1="10" y1="15" x2="14" y2="15"></line>
        </svg>
    );
}