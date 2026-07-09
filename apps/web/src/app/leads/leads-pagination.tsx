"use client";

import Link from "next/link";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface Props {
  page: number;
  totalPages: number;
}

export function LeadsPagination({
  page,
  totalPages,
}: Props) {
  const pages = [];

  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return (
    <Pagination className="mt-8">
      <PaginationContent>
        <PaginationItem>
          {page > 1 ? (
            <PaginationPrevious href={`?page=${page - 1}`} />
          ) : (
            <PaginationPrevious
              href="#"
              className="pointer-events-none opacity-50"
              aria-disabled
            />
          )}
        </PaginationItem>

        {start > 1 && (
          <>
            <PaginationItem>
              <PaginationLink href="?page=1">1</PaginationLink>
            </PaginationItem>

            {start > 2 && (
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
            )}
          </>
        )}

        {pages.map((p) => (
          <PaginationItem key={p}>
            <PaginationLink
              href={`?page=${p}`}
              isActive={page === p}
            >
              {p}
            </PaginationLink>
          </PaginationItem>
        ))}

        {end < totalPages && (
          <>
            {end < totalPages - 1 && (
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
            )}

            <PaginationItem>
              <Link href={`?page=${totalPages}`}>
                <PaginationLink>
                  {totalPages}
                </PaginationLink>
              </Link>
            </PaginationItem>
          </>
        )}

        <PaginationItem>
          {page < totalPages ? (
            <PaginationNext href={`?page=${page + 1}`} />
          ) : (
            <PaginationNext
              href="#"
              className="pointer-events-none opacity-50"
              aria-disabled
            />
          )}
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
