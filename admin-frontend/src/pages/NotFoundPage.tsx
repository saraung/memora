import { Link } from "react-router-dom";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-app px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft">
        <FileQuestion className="size-7 text-primary" aria-hidden />
      </span>
      <h1 className="text-xl font-display font-extrabold text-1">
        Page not found
      </h1>
      <p className="max-w-sm text-sm text-2">
        The page you were looking for doesn’t exist.
      </p>
      <Link to="/" className="mt-2">
        <Button variant="outline">Back to overview</Button>
      </Link>
    </div>
  );
}
