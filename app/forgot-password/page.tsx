import ForgotPasswordForm from "@/components/ForgotPasswordForm";

export default function ForgotPasswordPage() {
    return (
        <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-4 p-4 sm:p-8">
            <h1 className="text-3xl font-bold">Reset your password</h1>
            <ForgotPasswordForm />
        </main>
    );
}