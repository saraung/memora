import { z } from "zod";

export const USERNAME_RE = /^[a-zA-Z0-9_]+$/;

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or username"),
  password: z.string().min(1, "Enter your password"),
});

export type LoginForm = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(
      USERNAME_RE,
      "Only letters, numbers and underscores",
    ),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
  display_name: z
    .string()
    .trim()
    .max(80, "Display name must be at most 80 characters")
    .optional(),
});

export type RegisterForm = z.infer<typeof registerSchema>;

export const forgotSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});

export type ForgotForm = z.infer<typeof forgotSchema>;

export const resetSchema = z.object({
  token: z.string().trim().min(1, "Reset token is required"),
  new_password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
});

export type ResetForm = z.infer<typeof resetSchema>;
