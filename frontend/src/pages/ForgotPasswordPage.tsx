import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { Input } from "@/components/ui/Input";
import { forgotSchema, type ForgotForm } from "@/features/auth/schemas";
import { authApi } from "@/services/endpoints/auth";
import { ApiError } from "@/services/api-client";

export function ForgotPasswordPage() {
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotForm>({ resolver: zodResolver(forgotSchema) });

  const onSubmit = async (values: ForgotForm) => {
    setFormError(null);
    try {
      await authApi.forgotPassword(values.email);
      setSent(true);
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "Could not send the reset link. Please try again.",
      );
    }
  };

  if (sent) {
    return (
      <div className="text-center">
        <MailCheck className="mx-auto size-12 text-primary" aria-hidden />
        <h1 className="mt-4 text-2xl font-display font-extrabold tracking-tight text-1">
          Check your inbox
        </h1>
        <p className="mt-2 text-sm text-2">
          If an account exists for that email, a reset link is on its way
          (check the server console while email is stubbed).
        </p>
        <Link to="/login" className="mt-6 inline-block">
          <Button variant="outline">Back to sign in</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-display font-extrabold tracking-tight text-1 sm:text-3xl">
        Reset your password
      </h1>
      <p className="mt-2 text-sm text-2">
        Enter your account email and we&apos;ll send you a reset link.
      </p>
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="mt-6 space-y-4"
      >
        <FormError message={formError} />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          {...register("email")}
        />
        <Button type="submit" loading={isSubmitting} className="w-full" size="lg">
          Send reset link
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-2">
        Remembered it?{" "}
        <Link
          to="/login"
          className="font-semibold text-primary hover:text-primary"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
