import { redirect } from 'next/navigation';
import { eq, desc } from 'drizzle-orm';
import { TopBar } from "@/components/destified/topbar";
import { TripHeader } from "@/components/destified/trip-header";
import { TimelinePanel } from "@/components/destified/timeline-panel";
import { RouteMap } from "@/components/destified/route-map";
import { RightRail } from "@/components/destified/right-rail";
import { FlowModal } from "@/components/destified/flow-modal";
import { getSessionUserId } from "@/lib/session";
import { getProfileAction, getTripContextAction } from "@/lib/profile-actions";
import { db } from "@/lib/db/client";
import { trip } from "@/lib/db/schema";

export default async function OrganizerPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const profile = await getProfileAction();
  if (!profile) redirect('/onboarding');

  const trips = await db.select().from(trip).where(eq(trip.userId, userId)).orderBy(desc(trip.createdAt)).limit(1);
  if (trips.length === 0) redirect('/login'); // signInDemoAction always seeds one; defensive
  const activeTrip = trips[0];
  const tripContext = await getTripContextAction(activeTrip.id);

  return (
    <>
      <TopBar />
      <TripHeader tripId={activeTrip.id} tripContext={tripContext} />
      <main className="grid grid-cols-1 items-start gap-4 px-7 pb-10 pt-2 lg:grid-cols-[420px_1fr] xl:grid-cols-[420px_1fr_360px]">
        <TimelinePanel />
        <RouteMap />
        <div className="xl:sticky xl:top-[76px] xl:max-h-[calc(100vh-92px)] xl:overflow-y-auto xl:pr-1">
          <RightRail />
        </div>
      </main>
      <FlowModal />
    </>
  );
}
