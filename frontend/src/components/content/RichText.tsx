import { Fragment } from "react";
import { Link } from "react-router-dom";

const TOKEN_RE = /(#[A-Za-z0-9_]{1,100}|@[A-Za-z0-9_]{3,30})/g;

/** Render hashtags and mentions as links, preserving other text. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(TOKEN_RE);
  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.startsWith("#") && part.length > 1) {
          const tag = part.slice(1);
          return (
            <Link
              key={i}
              to={`/h/${tag}`}
              className="font-medium text-primary hover:underline"
            >
              {part}
            </Link>
          );
        }
        if (part.startsWith("@") && part.length > 1) {
          const username = part.slice(1);
          return (
            <Link
              key={i}
              to={`/u/${username}`}
              className="font-medium text-primary hover:underline"
            >
              {part}
            </Link>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </span>
  );
}
