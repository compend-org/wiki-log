export default function SearchIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://w3.org"
            height="24"
            viewBox="0 0 24 24"
            width="24"
            fill="none"
            stroke="currentColor"
            className={className}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">
            
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
    );
}