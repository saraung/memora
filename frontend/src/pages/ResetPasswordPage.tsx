import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { Input, PasswordInput } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { resetSchema, type ResetForm } from "@/features/auth/schemas";
import { authApi } from "@/services/endpoints/auth";
import { ApiError } from "@/services/api-client";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
    defaultValues: { token: searchParams.get("token") ?? "" },
  });

  const onSubmit = async (values: ResetForm) => {
    setFormError(null);
    try {
      await authApi.resetPassword(values.token, values.new_password);
      toast("Password updated. Please sign in.", "success");
      navigate("/login", { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "Could not reset your password. The link may be invalid or expired.",
      );
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-display font-extrabold tracking-tight text-1 sm:text-3xl">
        Choose a new password
      </h1>
      <p className="mt-2 text-sm text-2">
        Paste your reset token (or open the link from your email) and pick a
        new password.
      </p>
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="mt-6 space-y-4"
      >
        <FormError message={formError} />
        <Input
          label="Reset token"
          placeholder="Token from your email"
          autoComplete="off"
          error={errors.token?.message}
          {...register("token")}
        />
        <PasswordInput
          label="New password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          error={errors.new_password?.message}
          {...register("new_password")}
        />
        <Button type="submit" loading={isSubmitting} className="w-full" size="lg">
          Update password
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-2">
        <Link
          to="/login"
          className="font-semibold text-primary hover:text-primary"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
