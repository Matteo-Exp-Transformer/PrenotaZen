const APP_LOGO_SRC = `${import.meta.env.BASE_URL}icons/icon-192-v2.png`

export function PublicMenuPageHeader({ name }: { name: string }) {
  return (
    <header className="sticky top-0 z-10 bg-stone-800 px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <img
          src={APP_LOGO_SRC}
          alt=""
          aria-hidden
          className="h-9 w-9 shrink-0 rounded-full object-contain"
        />
        <h1 className="min-w-0 flex-1 text-lg font-bold text-white leading-tight truncate">
          {name}
        </h1>
      </div>
    </header>
  )
}
