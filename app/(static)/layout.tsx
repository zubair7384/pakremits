import Link from 'next/link'
import { SiteFooter, SiteHeader } from '@/components/site-chrome'

/**
 * Shared shell for the short editorial pages: about, contact, privacy and the
 * affiliate disclosure. A route group so it adds a layout without adding a
 * path segment — these pages live at /about, not /static/about.
 */
export default function StaticLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1120px] px-6 py-14">
        <nav aria-label="Breadcrumb" className="text-[13px] text-muted">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="no-underline hover:text-leaf">
                Bhejo
              </Link>
            </li>
          </ol>
        </nav>
        <article className="prose-bhejo mt-5 max-w-[68ch]">{children}</article>
      </main>
      <SiteFooter />
    </>
  )
}
