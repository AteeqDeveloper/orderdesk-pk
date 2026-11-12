"use client";

import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";

export default function ProductImage({
  src,
  alt = "",
  className = "",
  iconClassName = "h-4 w-4 text-ink-300",
}) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden bg-ink-50 ${className}`}
    >
      {src && !hasError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setHasError(true)}
        />
      ) : (
        <ImageOff className={iconClassName} aria-hidden="true" />
      )}
    </div>
  );
}
