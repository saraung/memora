import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { Input, PasswordInput } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { registerSchema, type RegisterForm } from "@/features/auth/schemas";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/services/api-client";

export function RegisterPage() {
  const { register: signup } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (values: RegisterForm) => {
    setFormError(null);
    try {
      const user = await signup({
        email: values.email,
        username: values.username,
        password: values.password,
        display_name: values.display_name || undefined,
      });
      toast(
        `Welcome to Memora, ${user.display_name}! Check your email to verify.`,
        "success",
      );
      navigate("/", { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "Could not create your account. Please try again.",
      );
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-display font-extrabold tracking-tight text-1 sm:text-3xl">
        Create your account
      </h1>
      <p className="mt-2 text-sm text-2">
        Join Memora to share moments with your people.
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
        <Input
          label="Username"
          autoComplete="username"
          placeholder="memora_user"
          hint="3–30 characters: letters, numbers and underscores."
          error={errors.username?.message}
          {...register("username")}
        />
        <Input
          label="Display name (optional)"
          autoComplete="name"
          placeholder="Your name"
          error={errors.display_name?.message}
          {...register("display_name")}
        />
        <PasswordInput
          label="Password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          error={errors.password?.message}
          {...register("password")}
        />
        <Button type="submit" loading={isSubmitting} className="w-full" size="lg">
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-2">
        Already have an account?{" "}
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
