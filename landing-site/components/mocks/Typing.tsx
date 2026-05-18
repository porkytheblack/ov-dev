export function TypingDots({ tint = "wa" }: { tint?: "wa" | "tg" }) {
  const bg = tint === "wa" ? "bg-whatsapp-bubble" : "bg-telegram-bubble";
  return (
    <div className="flex justify-start">
      <div className={`flex items-center gap-1 rounded-2xl ${bg} px-3 py-2.5`}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="inline-block h-1.5 w-1.5 rounded-full bg-[#8696a0] animate-typing"
            style={{ animationDelay: `${i * 0.16}s` }}
          />
        ))}
      </div>
    </div>
  );
}
