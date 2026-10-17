import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { authApi } from "@/services/endpoints/auth";
import { ApiError } from "@/services/api-client";

type State =
  | { kind: "idle" }
  | { kind: "verifying" }
  | { kind: "success" }
  | { kind: "error"; message: string };

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, setState] = useState<State>({ kind: "idle" });
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    setState({ kind: "verifying" });
    authApi
      .verifyEmail(token)
      .then(() => setState({ kind: "success" }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message:
            error instanceof ApiError
              ? error.message
              : "Verification failed. The link may be invalid or expired.",
        }),
      );
  }, [token]);

  if (!token) {
    return (
      <div>
        <h1 className="text-2xl font-display font-extrabold tracking-tight text-1">
          Verify your email
        </h1>
        <p className="mt-2 text-sm text-2">
          This page needs a verification link. Check your inbox for the email
          we sent when you registered (look in the server console while email
          is stubbed).
        </p>
        <Link to="/login" className="mt-6 inline-block">
          <Button variant="outline">Back to sign in</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center">
      {state.kind === "verifying" || state.kind === "idle" ? (
        <>
          <Spinner className="mx-auto size-10" />
          <h1 className="mt-4 text-2xl font-display font-extrabold tracking-tight text-1">
            Verifying your email…
          </h1>
        </>
      ) : state.kind === "success" ? (
        <>
          <CheckCircle2
            className="mx-auto size-12 text-green-600 dark:text-green-400"
            aria-hidden
          />
          <h1 className="mt-4 text-2xl font-display font-extrabold tracking-tight text-1">
            Email verified
          </h1>
          <p className="mt-2 text-sm text-2">
            Your account is now verified. Welcome aboard!
          </p>
          <Link to="/" className="mt-6 inline-block">
            <Button size="lg">Continue to Memora</Button>
          </Link>
        </>
      ) : (
        <>
          <XCircle className="mx-auto size-12 text-red-500" aria-hidden />
          <h1 className="mt-4 text-2xl font-display font-extrabold tracking-tight text-1">
            Verification failed
          </h1>
          <p role="alert" className="mt-2 text-sm text-2">
            {state.message}
          </p>
          <Link to="/login" className="mt-6 inline-block">
            <Button variant="outline">Back to sign in</Button>
          </Link>
        </>
      )}
    </div>
  );
}
