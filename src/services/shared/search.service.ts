import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../helper/prisma";
import { toMajorUnits } from "../../utils/money";

type SearchItem = { id: string; title: string; subtitle: string; href: string; avatar?: string | null };
type SearchGroup = { key: string; label: string; items: SearchItem[] };

const PER_GROUP = 5;

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(toMajorUnits(minor));

const contains = (q: string) => ({ contains: q, mode: "insensitive" as const });

const nameOf = (person?: { first_name: string | null; last_name: string | null } | null, fallback = "Driver") =>
  [person?.first_name, person?.last_name].filter(Boolean).join(" ") || fallback;

const labelOf = (status: string) => status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");

// "Mike Thomas" should match a first/last split, so every word has to land on some name field.
const personMatch = (q: string, extra: Prisma.UserWhereInput[] = []): Prisma.UserWhereInput => ({
  OR: [
    { AND: q.split(/\s+/).map(word => ({ OR: [{ first_name: contains(word) }, { last_name: contains(word) }] })) },
    ...extra,
  ],
});

const groups = (entries: [string, string, SearchItem[]][]): SearchGroup[] =>
  entries.filter(([, , items]) => items.length).map(([key, label, items]) => ({ key, label, items }));

export class SearchService {
  async forClient(clientId: string, q: string) {
    const [hires, drivers, hireRequests, invoices, requests] = await Promise.all([
      prisma.booking.findMany({
        where: { clientId, driverId: { not: null }, OR: [{ reference: contains(q) }, { driver: personMatch(q) }] },
        select: { id: true, reference: true, status: true, driver: { select: { first_name: true, last_name: true, profile_pic: true } } },
        orderBy: { createdAt: "desc" },
        take: PER_GROUP,
      }),
      prisma.user.findMany({
        where: { role: "DRIVER", anonymised_at: null, driver_profile: { verification_status: "APPROVED", is_discoverable: true }, ...personMatch(q) },
        select: { id: true, first_name: true, last_name: true, profile_pic: true, state_of_residence: true, driver_profile: { select: { trust_score: true } } },
        orderBy: { driver_profile: { trust_score: "desc" } },
        take: PER_GROUP,
      }),
      prisma.hireRequest.findMany({
        where: { clientId, reference: contains(q) },
        select: { id: true, reference: true, status: true, drivers_needed: true, starts_at: true },
        orderBy: { createdAt: "desc" },
        take: PER_GROUP,
      }),
      prisma.hireInvoice.findMany({
        where: { hire_request: { clientId }, OR: [{ reference: contains(q) }, { hire_request: { reference: contains(q) } }] },
        select: { id: true, reference: true, status: true, total_minor: true, currency: true, hire_request: { select: { reference: true } } },
        orderBy: { createdAt: "desc" },
        take: PER_GROUP,
      }),
      prisma.staffingRequest.findMany({
        where: { clientId, OR: [{ reference: contains(q) }, { title: contains(q) }] },
        select: { id: true, reference: true, title: true, status: true },
        orderBy: { createdAt: "desc" },
        take: PER_GROUP,
      }),
    ]);

    return groups([
      [
        "hires",
        "Your drivers",
        hires.map(hire => ({
          id: hire.id,
          title: nameOf(hire.driver),
          subtitle: `${hire.reference} · ${labelOf(hire.status)}`,
          href: `/dashboard/my-hire/${hire.reference}`,
          avatar: hire.driver?.profile_pic ?? null,
        })),
      ],
      [
        "drivers",
        "Drivers on Haya Drivers",
        drivers.map(driver => ({
          id: driver.id,
          title: nameOf(driver),
          subtitle: [`Trust ${driver.driver_profile?.trust_score ?? 0}`, driver.state_of_residence].filter(Boolean).join(" · "),
          href: `/dashboard/drivers/${driver.id}`,
          avatar: driver.profile_pic,
        })),
      ],
      [
        "hire-requests",
        "Hire requests",
        hireRequests.map(request => ({
          id: request.id,
          title: request.reference,
          subtitle: `${labelOf(request.status)} · ${request.drivers_needed} driver${request.drivers_needed > 1 ? "s" : ""}`,
          href: `/dashboard/my-hire/requests/${request.reference}`,
        })),
      ],
      [
        "invoices",
        "Invoices",
        invoices.map(invoice => ({
          id: invoice.id,
          title: invoice.reference,
          subtitle: `${money(invoice.total_minor, invoice.currency)} · ${labelOf(invoice.status)}`,
          href: `/dashboard/billing/${invoice.hire_request.reference}`,
        })),
      ],
      [
        "requests",
        "Requests",
        requests.map(request => ({
          id: request.id,
          title: request.title,
          subtitle: `${request.reference} · ${labelOf(request.status)}`,
          href: `/dashboard/requests/${request.reference}`,
        })),
      ],
    ]);
  }

  async forDriver(driverId: string, q: string) {
    const [jobs, reviews] = await Promise.all([
      prisma.booking.findMany({
        where: {
          driverId,
          OR: [{ reference: contains(q) }, { title: contains(q) }, { client: personMatch(q, [{ client_profile: { organisation_name: contains(q) } }]) }],
        },
        select: {
          id: true,
          reference: true,
          status: true,
          client: { select: { first_name: true, last_name: true, profile_pic: true, client_profile: { select: { organisation_name: true } } } },
        },
        orderBy: { starts_at: "desc" },
        take: PER_GROUP,
      }),
      prisma.review.findMany({
        where: { subjectId: driverId, OR: [{ comment: contains(q) }, { author: personMatch(q, [{ client_profile: { organisation_name: contains(q) } }]) }] },
        select: {
          id: true,
          rating: true,
          comment: true,
          author: { select: { first_name: true, last_name: true, profile_pic: true, client_profile: { select: { organisation_name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: PER_GROUP,
      }),
    ]);

    return groups([
      [
        "jobs",
        "Jobs",
        jobs.map(job => ({
          id: job.id,
          title: job.client.client_profile?.organisation_name || nameOf(job.client, "Client"),
          subtitle: `${job.reference} · ${labelOf(job.status)}`,
          href: `/dashboard/job-request/${job.reference}`,
          avatar: job.client.profile_pic,
        })),
      ],
      [
        "reviews",
        "Reviews",
        reviews.map(review => ({
          id: review.id,
          title: review.author.client_profile?.organisation_name || nameOf(review.author, "Client"),
          subtitle: `${review.rating}★${review.comment ? ` · "${review.comment.slice(0, 70)}${review.comment.length > 70 ? "…" : ""}"` : ""}`,
          href: "/dashboard/reviews",
          avatar: review.author.profile_pic,
        })),
      ],
    ]);
  }

  async forAdmin(q: string) {
    const contact = [{ email: contains(q) }, { phone_no: contains(q) }];

    const [drivers, clients, hireRequests, bookings] = await Promise.all([
      prisma.user.findMany({
        where: { role: "DRIVER", ...personMatch(q, contact) },
        select: { id: true, first_name: true, last_name: true, email: true, profile_pic: true, driver_profile: { select: { verification_status: true } } },
        orderBy: { createdAt: "desc" },
        take: PER_GROUP,
      }),
      prisma.user.findMany({
        where: { role: "CLIENT", ...personMatch(q, [...contact, { client_profile: { organisation_name: contains(q) } }]) },
        select: { id: true, first_name: true, last_name: true, email: true, profile_pic: true, client_profile: { select: { organisation_name: true } } },
        orderBy: { createdAt: "desc" },
        take: PER_GROUP,
      }),
      prisma.hireRequest.findMany({
        where: { OR: [{ reference: contains(q) }, { invoice: { reference: contains(q) } }] },
        select: {
          id: true,
          reference: true,
          status: true,
          invoice: { select: { reference: true } },
          client: { select: { first_name: true, last_name: true, client_profile: { select: { organisation_name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: PER_GROUP,
      }),
      prisma.booking.findMany({
        where: { reference: contains(q), driverId: { not: null } },
        select: {
          id: true,
          reference: true,
          status: true,
          driverId: true,
          driver: { select: { first_name: true, last_name: true } },
          client: { select: { first_name: true, last_name: true, client_profile: { select: { organisation_name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: PER_GROUP,
      }),
    ]);

    const clientName = (client: { first_name: string | null; last_name: string | null; client_profile: { organisation_name: string | null } | null }) =>
      client.client_profile?.organisation_name || nameOf(client, "Client");

    return groups([
      [
        "drivers",
        "Drivers",
        drivers.map(driver => ({
          id: driver.id,
          title: nameOf(driver),
          subtitle: `${driver.email} · ${labelOf(driver.driver_profile?.verification_status ?? "UNSUBMITTED")}`,
          href: `/dashboard/drivers/${driver.id}`,
          avatar: driver.profile_pic,
        })),
      ],
      [
        "clients",
        "Clients",
        clients.map(client => ({
          id: client.id,
          title: clientName(client),
          subtitle: client.email,
          href: `/dashboard/clients/${client.id}`,
          avatar: client.profile_pic,
        })),
      ],
      [
        "hire-requests",
        "Hire requests",
        hireRequests.map(request => ({
          id: request.id,
          title: request.reference,
          subtitle: [clientName(request.client), labelOf(request.status), request.invoice?.reference].filter(Boolean).join(" · "),
          href: `/dashboard/hires?q=${request.reference}`,
        })),
      ],
      [
        "bookings",
        "Bookings",
        bookings.map(booking => ({
          id: booking.id,
          title: booking.reference,
          subtitle: `${nameOf(booking.driver)} for ${clientName(booking.client)} · ${labelOf(booking.status)}`,
          href: `/dashboard/drivers/${booking.driverId}`,
        })),
      ],
    ]);
  }
}
