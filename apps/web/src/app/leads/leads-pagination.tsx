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
            <Link href={`?page=${page - 1}`}>
              <PaginationPrevious />
            </Link>
          ) : (
            <PaginationPrevious className="pointer-events-none opacity-50" />
          )}
        </PaginationItem>

        {start > 1 && (
          <>
            <PaginationItem>
              <Link href="?page=1">
                <PaginationLink>1</PaginationLink>
              </Link>
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
             <Link href={`?page=${p}`}>
            <PaginationLink
              isActive={page === p}
            >
              {p}
            </PaginationLink>
            </Link>
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
            <Link href={`?page=${page + 1}`}>
              <PaginationNext />
            </Link>
          ) : (
            <PaginationNext className="pointer-events-none opacity-50" />
          )}
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
