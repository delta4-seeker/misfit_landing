import Link from "next/link";

export function Pagination({
  page,
  totalPages,
  basePath,
  query = {},
}: {
  page: number;
  totalPages: number;
  basePath: string;
  query?: Record<string, string | undefined>;
}) {
  function href(target: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
    if (target > 1) params.set("page", String(target));
    const search = params.toString();
    return search ? `${basePath}?${search}` : basePath;
  }

  const visible = Array.from({ length: totalPages }, (_, index) => index + 1)
    .filter((number) => number === 1 || number === totalPages || Math.abs(number - page) <= 1);

  return (
    <nav className="pagination" aria-label="Pagination">
      {page > 1 ? <Link className="pagination-arrow" href={href(page - 1)} rel="prev">← Previous</Link> : <span className="pagination-arrow disabled" aria-disabled="true">← Previous</span>}
      <div className="pagination-pages">
        {visible.map((number, index) => (
          <span className="pagination-slot" key={number}>
            {index > 0 && number - visible[index - 1] > 1 && <span className="pagination-ellipsis" aria-hidden="true">…</span>}
            {number === page
              ? <span className="pagination-current" aria-current="page">{number}</span>
              : <Link href={href(number)} aria-label={`Go to page ${number}`}>{number}</Link>}
          </span>
        ))}
      </div>
      {page < totalPages ? <Link className="pagination-arrow" href={href(page + 1)} rel="next">Next →</Link> : <span className="pagination-arrow disabled" aria-disabled="true">Next →</span>}
    </nav>
  );
}
