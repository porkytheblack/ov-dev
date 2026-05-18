export function TypingDots({ tint = "wa" }: { tint?: "wa" | "tg" }) {
  return (
    <div className="flex justify-start">
      <div
        className={`flex items-center gap-1 rounded-2xl rounded-bl-md bg-white px-3 py-2.5 shadow-sm`}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="inline-block h-1.5 w-1.5 rounded-full bg-[#9aa6b0] animate-typing"
            style={{ animationDelay: `${i * 0.16}s` }}
          />
        ))}
      </div>
    </div>
  );
}
