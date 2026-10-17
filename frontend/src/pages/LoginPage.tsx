import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { Input, PasswordInput } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { loginSchema, type LoginForm } from "@/features/auth/schemas";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/services/api-client";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginForm) => {
    setFormError(null);
    try {
      const user = await login(values);
      toast(`Welcome back, ${user.display_name}!`, "success");
      navigate("/", { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "Could not sign in. Please try again.",
      );
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-display font-extrabold tracking-tight text-1 sm:text-3xl">
        Welcome back
      </h1>
      <p className="mt-2 text-sm text-2">
        Sign in to continue to Memora.
      </p>

      {searchParams.get("expired") && (
        <p
          role="status"
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-500/25 dark:bg-amber-400/10 dark:text-amber-200"
        >
          Your session expired. Please sign in again.
        </p>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="mt-6 space-y-4"
      >
        <FormError message={formError} />
        <Input
          label="Email or username"
          autoComplete="username"
          placeholder="you@example.com"
          error={errors.identifier?.message}
          {...register("identifier")}
        />
        <div>
          <PasswordInput
            label="Password"
            autoComplete="current-password"
            placeholder="••••••••"
            error={errors.password?.message}
            {...register("password")}
          />
          <div className="mt-2 text-right">
            <Link
              to="/forgot-password"
              className="text-sm font-semibold text-primary hover:text-primary"
            >
              Forgot password?
            </Link>
          </div>
        </div>
        <Button type="submit" loading={isSubmitting} className="w-full" size="lg">
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-2">
        New to Memora?{" "}
        <Link
          to="/register"
          className="font-semibold text-primary hover:text-primary"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
